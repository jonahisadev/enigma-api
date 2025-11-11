import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateVaultRequest, UpdateVaultRequest } from '../types/requests';
import { VaultResponse, VaultsListResponse } from '../types/responses';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError, ConflictError, NotFoundError } from '../services/errors';
import { v4 as uuid } from 'uuid';
import { Vault } from '../models/vault.model';
import { VaultRepository } from '../repositories/vault.repository';
import { SecretRepository } from '../repositories/secret.repository';
import { KmsFactory } from '../services/kms/factory';
import { getVaultAccess } from '../services/auth.service';

export async function createVault(
  request: FastifyRequest<{ Body: CreateVaultRequest }>,
  reply: FastifyReply
): Promise<VaultResponse> {
  const { name } = request.body;
  const { isAdmin } = getVaultAccess(request.user, '');
  if (!isAdmin) {
    throw new BadRequestError('Insufficient permissions to create vault');
  }

  const user = await UserRepository.findOne({
    where: {
      publicId: request.user.userId
    }
  });

  if (!user) {
    throw new BadRequestError("Invalid request");
  }

  const existingVault = await VaultRepository.findOne({
    where: {
      name,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (existingVault) {
    throw new ConflictError(`Vault with name ${name} already exists`);
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
  const { id: vaultId } = request.params;
  const { hasAccess } = getVaultAccess(request.user, vaultId);
  if (!hasAccess) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
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

  let results = vaults;
  if (request.user.authType !== 'password') {
    const allowedVaults = request.user.vaultPermissions?.map(vp => vp.vaultId);
    results = vaults.filter(vault => allowedVaults?.includes(vault.publicId));
  }

  return reply.status(200).send({
    vaults: results.map(vault => ({
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
  const { hasAccess, canWrite } = getVaultAccess(request.user, request.params.id);
  if (!hasAccess || !canWrite) {
    throw new NotFoundError(`Vault not found by ID ${request.params.id}`);
  }

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
  const { hasAccess, canWrite } = getVaultAccess(request.user, vaultId);
  if (!hasAccess || !canWrite) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

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
