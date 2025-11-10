import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateVaultRequest, UpdateVaultRequest } from '../types/requests';
import { VaultResponse, VaultsListResponse } from '../types/responses';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError, NotFoundError } from '../services/errors';
import { v4 as uuid } from 'uuid';
import { Vault } from '../models/vault.model';
import { VaultRepository } from '../repositories/vault.repository';
import { SecretRepository } from '../repositories/secret.repository';
import { KmsFactory } from '../services/kms/factory';

export async function createVault(
  request: FastifyRequest<{ Body: CreateVaultRequest }>,
  reply: FastifyReply
): Promise<VaultResponse> {
  const { name } = request.body;

  const user = await UserRepository.findOne({
    where: {
      publicId: request.user.userId
    }
  });

  if (!user) {
    throw new BadRequestError("Invalid request");
  }

  // Generate vault key
  const kmsProvider = KmsFactory.createProvider(user.kmsProvider, user.accountKeyId);
  const vaultKey = await kmsProvider.generateVaultKey();

  // Save vault to database
  const vault = new Vault();
  vault.publicId = uuid();
  vault.name = name;
  vault.encryptionKey = vaultKey.key.toString('base64');
  vault.keyIv = vaultKey.iv.toString('base64');
  vault.secrets = [];
  vault.user = user;
  await VaultRepository.save(vault);

  // Return vault response
  return reply.status(201).send({
    publicId: vault.publicId,
    name: vault.name,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt
  });
}

export async function getVault(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<VaultResponse> {
  const { id: publicId } = request.params;
  const vault = await VaultRepository.findOne({
    where: { publicId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${publicId}`);
  }

  return reply.status(200).send({
    publicId: vault.publicId,
    name: vault.name,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt
  });
}

export async function getVaults(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<VaultsListResponse> {
  const userId = request.user.userId;
  const vaults = await VaultRepository.find({
    where: {
      user: {
        publicId: userId
      }
    }
  });

  return reply.status(200).send({
    vaults: vaults.map(vault => ({
      publicId: vault.publicId,
      name: vault.name,
      createdAt: vault.createdAt,
      updatedAt: vault.updatedAt
    }))
  });
}

export async function updateVault(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateVaultRequest }>,
  reply: FastifyReply
): Promise<VaultResponse> {
  const { name } = request.body;

  const vault = await VaultRepository.findOne({
    where: { publicId: request.params.id },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${request.params.id}`);
  }

  vault.name = name;
  await VaultRepository.save(vault);

  return reply.status(200).send({
    publicId: vault.publicId,
    name: vault.name,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt
  });
}

export async function deleteVault(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const { id: vaultId } = request.params;
  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  // Delete all secrets associated with this vault
  await SecretRepository.delete({ vault: { id: vault.id } });

  // Delete the vault
  await VaultRepository.delete(vault.id);
  return reply.status(200).send({ message: 'Vault deleted successfully' });
}
