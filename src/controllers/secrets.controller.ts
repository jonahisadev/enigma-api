import { FastifyRequest, FastifyReply } from 'fastify';
import { CreateSecretRequest, UpdateSecretRequest, GetSecretsQuery, DeleteSecretQuery } from '../types/requests';
import { SecretResponse, SecretsListResponse, DeleteSecretResponse } from '../types/responses';
import { VaultRepository } from '../repositories/vault.repository';
import { BadRequestError, NotFoundError } from '../services/errors';
import { Secret } from '../models/secret.model';
import { v4 as uuid } from 'uuid';
import { KmsFactory } from '../services/kms/factory';
import { aesDecrypt, aesEncrypt } from '../services/crypto.service';
import { SecretRepository } from '../repositories/secret.repository';

export async function createSecret(
  request: FastifyRequest<{ Params: { vaultId: string }; Body: CreateSecretRequest }>,
  reply: FastifyReply
): Promise<SecretResponse> {
  const vaultId = request.params.vaultId;
  const { name, value } = request.body;

  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  const existingSecret = await SecretRepository.findOne({
    where: { name, vault: { id: vault.id } },
  });

  if (existingSecret) {
    throw new BadRequestError(`Secret with name ${name} already exists in vault ${vaultId}`);
  }

  // Encrypt secret value with vault key
  const kmsProvider = KmsFactory.createProvider(vault.user.kmsProvider, vault.user.accountKeyId);
  const vaultKey = await kmsProvider.decryptVaultKey(vault.encryptionKey, vault.keyIv);
  const encryptedValue = aesEncrypt(Buffer.from(value, 'utf-8'), vaultKey).toString('base64');

  // Save secret to database
  const secret = new Secret();
  secret.publicId = uuid();
  secret.name = name;
  secret.vault = vault;
  secret.value = encryptedValue;
  secret.version = 1;
  await SecretRepository.save(secret);

  return reply.status(201).send({
    publicId: secret.publicId,
    name: secret.name,
    version: secret.version,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
}

export async function getSecret(
  request: FastifyRequest<{ Params: { vaultId: string; secretId: string } }>,
  reply: FastifyReply
): Promise<SecretResponse> {
  const { secretId, vaultId } = request.params;
  const secret = await SecretRepository.findOne({
    where: { publicId: secretId },
    relations: ['vault', 'vault.user'],
  });

  if (!secret
    || secret.vault.publicId !== vaultId
    || secret.vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Secret not found by ID ${secretId}`);
  }

  // Decrypt secret value with vault key
  const vault = secret.vault;
  const kmsProvider = KmsFactory.createProvider(vault.user.kmsProvider, vault.user.accountKeyId);
  const vaultKey = await kmsProvider.decryptVaultKey(vault.encryptionKey, vault.keyIv);
  const decryptedValue = aesDecrypt(Buffer.from(secret.value, 'base64'), vaultKey).toString('utf-8');

  return reply.status(200).send({
    publicId: secret.publicId,
    name: secret.name,
    value: decryptedValue,
    version: secret.version,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
  });
}

export async function getSecrets(
  request: FastifyRequest<{ Params: { vaultId: string }; Querystring: GetSecretsQuery }>,
  reply: FastifyReply
): Promise<SecretsListResponse> {
  const { vaultId } = request.params;
  const { name, latest } = request.query;

  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  const secrets = await SecretRepository.find({
    where: {
      ...(name && { name }),
      ...(latest !== undefined && { latest }),
      vault: {
        id: vault.id,
      }
    }
  });

  return reply.status(200).send({
    secrets: secrets.map(secret => ({
      publicId: secret.publicId,
      name: secret.name,
      version: secret.version,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    }))
  });
}

export async function updateSecret(
  request: FastifyRequest<{ Params: { vaultId: string; secretId: string }; Body: UpdateSecretRequest }>,
  reply: FastifyReply
): Promise<SecretResponse> {
  const { vaultId } = request.params;
  const { value } = request.body;

  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  const secret = await SecretRepository.findOne({
    where: {
      publicId: request.params.secretId,
      vault: {
        id: vault.id,
      }
    },
  });

  if (!secret) {
    throw new NotFoundError(`Secret not found by ID ${request.params.secretId}`);
  }

  // Encrypt new secret value with vault key
  const kmsProvider = KmsFactory.createProvider(vault.user.kmsProvider, vault.user.accountKeyId);
  const vaultKey = await kmsProvider.decryptVaultKey(vault.encryptionKey, vault.keyIv);
  const encryptedValue = aesEncrypt(Buffer.from(value, 'utf-8'), vaultKey).toString('base64');

  // Create new secret version
  const newSecret = new Secret();
  newSecret.publicId = uuid();
  newSecret.name = secret.name;
  newSecret.vault = vault;
  newSecret.version = secret.version + 1;
  newSecret.value = encryptedValue;
  newSecret.latest = true;
  await SecretRepository.save(newSecret);

  // Update previous secret to not be latest
  secret.latest = false;
  await SecretRepository.save(secret);

  return reply.status(200).send({
    publicId: newSecret.publicId,
    name: newSecret.name,
    version: newSecret.version,
    createdAt: newSecret.createdAt,
    updatedAt: newSecret.updatedAt,
  });
}

export async function deleteSecret(
  request: FastifyRequest<{ Params: { vaultId: string }; Querystring: DeleteSecretQuery }>,
  reply: FastifyReply
): Promise<DeleteSecretResponse> {
  const { vaultId } = request.params;
  const { name } = request.query;

  const vault = await VaultRepository.findOne({
    where: { publicId: vaultId },
    relations: ['user'],
  });

  if (!vault || vault.user.publicId !== request.user.userId) {
    throw new NotFoundError(`Vault not found by ID ${vaultId}`);
  }

  const secrets = await SecretRepository.find({
    where: {
      name,
      vault: {
        id: vault.id,
      }
    },
  });
  await SecretRepository.delete(secrets.map(secret => secret.id));

  return reply.status(200).send({
    message: `Deleted ${secrets.length} secrets with name ${name} from vault ${vaultId}`,
    deletedCount: secrets.length,
  });
}
