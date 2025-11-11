import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { buildAuthTestApp } from '../auth-helper';
import { User } from '../../models/user.model';
import { Vault } from '../../models/vault.model';
import { Secret } from '../../models/secret.model';
import secretRoutes from '../../routes/secrets.route';

// Mock AppDataSource first (before repositories are imported)
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
    })),
  },
}));

// Mock the repositories
jest.mock('../../repositories/vault.repository', () => ({
  VaultRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

jest.mock('../../repositories/secret.repository', () => ({
  SecretRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  },
}));

// Mock KMS Factory
jest.mock('../../services/kms/factory');

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid-' + Math.random().toString(36).substring(7),
}));

// Mock crypto service
jest.mock('../../services/crypto.service', () => ({
  aesEncrypt: jest.fn((data: Buffer) => Buffer.from('encrypted-' + data.toString())),
  aesDecrypt: jest.fn((data: Buffer) => Buffer.from(data.toString().replace('encrypted-', ''))),
}));

import { VaultRepository } from '../../repositories/vault.repository';
import { SecretRepository } from '../../repositories/secret.repository';
import { KmsFactory } from '../../services/kms/factory';

describe('Secret Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAuthTestApp();
    // Register secret routes
    await app.register(secretRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup KMS Factory mock
    const mockDecryptVaultKey = jest.fn();
    (mockDecryptVaultKey as any).mockResolvedValue({
      key: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      iv: Buffer.from('0123456789abcdef', 'hex'),
    });

    (KmsFactory.createProvider as jest.Mock).mockReturnValue({
      decryptVaultKey: mockDecryptVaultKey,
    });
  });

  describe('POST /vaults/:vaultId/secrets', () => {
    it('should successfully create a secret with valid data', async () => {
      // Arrange: Mock user, vault, and secret save
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
        kmsProvider: 'local' as const,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'My Vault',
        encryptionKey: 'encrypted-key',
        keyIv: 'iv',
        user: mockUser,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.findOne as any).mockResolvedValue(null); // No existing secret

      // Mock SecretRepository.save to add timestamps
      (SecretRepository.save as any).mockImplementation((secret: Secret) => {
        secret.createdAt = new Date();
        secret.updatedAt = new Date();
        return Promise.resolve(secret);
      });

      // Generate access token
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Create secret request
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'my-secret',
          value: 'secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('publicId');
      expect(body.name).toBe('my-secret');
      expect(body.version).toBe(1);
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');

      // Verify repository methods were called
      expect(VaultRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockVaultId },
        relations: ['user'],
      });
      expect(SecretRepository.save).toHaveBeenCalled();
    });

    it('should fail when vault not found', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'my-secret',
          value: 'secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });

    it('should fail when vault belongs to different user', async () => {
      // Arrange: Mock vault owned by different user
      const ownerUserId = randomUUID();
      const requestingUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockOwner = {
        id: 1,
        publicId: ownerUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockOwner,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      // Generate access token for different user
      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'my-secret',
          value: 'secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });

    it('should fail when secret with same name already exists', async () => {
      // Arrange: Mock vault and existing secret
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
        kmsProvider: 'local' as const,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      const existingSecret = {
        id: 1,
        name: 'my-secret',
        vault: mockVault,
      } as Secret;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.findOne as any).mockResolvedValue(existingSecret);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'my-secret',
          value: 'secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('already exists');
    });

    it('should fail with missing name field', async () => {
      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Create secret without name
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          value: 'secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('should fail with missing value field', async () => {
      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Create secret without value
      const response = await app.inject({
        method: 'POST',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'my-secret',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /vaults/:vaultId/secrets/:secretId', () => {
    it('should successfully retrieve and decrypt a secret', async () => {
      // Arrange: Mock secret with vault and user
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
        kmsProvider: 'local' as const,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        encryptionKey: 'encrypted-key',
        keyIv: 'iv',
        user: mockUser,
      } as Vault;

      const mockSecret = {
        id: 1,
        publicId: mockSecretId,
        name: 'my-secret',
        value: Buffer.from('encrypted-secret-value').toString('base64'),
        version: 1,
        vault: mockVault,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Secret;

      (SecretRepository.findOne as any).mockResolvedValue(mockSecret);

      // Generate access token
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Get secret request
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.publicId).toBe(mockSecretId);
      expect(body.name).toBe('my-secret');
      expect(body).toHaveProperty('value');
      expect(body.version).toBe(1);
    });

    it('should fail when secret not found', async () => {
      // Arrange: Mock secret not found
      (SecretRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Secret not found');
    });

    it('should fail when vault ID does not match', async () => {
      // Arrange: Secret belongs to different vault
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const wrongVaultId = randomUUID();
      const mockSecretId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      const mockSecret = {
        id: 1,
        publicId: mockSecretId,
        vault: mockVault,
      } as Secret;

      (SecretRepository.findOne as any).mockResolvedValue(mockSecret);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Request with wrong vault ID
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${wrongVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });

    it('should fail when secret belongs to different user', async () => {
      // Arrange: Secret belongs to different user
      const ownerUserId = randomUUID();
      const requestingUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();

      const mockOwner = {
        id: 1,
        publicId: ownerUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockOwner,
      } as Vault;

      const mockSecret = {
        id: 1,
        publicId: mockSecretId,
        vault: mockVault,
      } as Secret;

      (SecretRepository.findOne as any).mockResolvedValue(mockSecret);

      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /vaults/:vaultId/secrets', () => {
    it('should successfully retrieve all secrets in vault', async () => {
      // Arrange: Mock vault and secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      const mockSecrets = [
        {
          id: 1,
          publicId: randomUUID(),
          name: 'secret-1',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Secret,
        {
          id: 2,
          publicId: randomUUID(),
          name: 'secret-2',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Secret,
      ];

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue(mockSecrets);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.secrets).toHaveLength(2);
      expect(body.secrets[0].name).toBe('secret-1');
      expect(body.secrets[1].name).toBe('secret-2');
    });

    it('should filter secrets by name when name query param provided', async () => {
      // Arrange: Mock vault and secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      // Mock only returns secrets with name 'secret-1' since filtering happens in DB
      const filteredSecrets = [
        {
          id: 1,
          publicId: randomUUID(),
          name: 'secret-1',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Secret,
        {
          id: 2,
          publicId: randomUUID(),
          name: 'secret-1',
          version: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Secret,
      ];

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue(filteredSecrets);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Filter by name
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets?name=secret-1`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.secrets).toHaveLength(2);
      expect(body.secrets.every((s: any) => s.name === 'secret-1')).toBe(true);
    });

    it('should filter secrets by latest flag when latest query param provided', async () => {
      // Arrange: Mock vault and secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      const latestSecrets = [
        {
          id: 2,
          publicId: randomUUID(),
          name: 'secret-1',
          version: 2,
          latest: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Secret,
      ];

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue(latestSecrets);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Filter by latest
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets?latest=true`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.secrets).toHaveLength(1);
      expect(SecretRepository.find).toHaveBeenCalledWith({
        where: {
          latest: true,
          vault: { id: mockVault.id },
        },
      });
    });

    it('should return empty array when vault has no secrets', async () => {
      // Arrange: Mock vault with no secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue([]);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.secrets).toHaveLength(0);
    });

    it('should fail when vault not found', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /vaults/:vaultId/secrets/:secretId', () => {
    it('should successfully update secret (create new version)', async () => {
      // Arrange: Mock vault and secret
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
        kmsProvider: 'local' as const,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        encryptionKey: 'encrypted-key',
        keyIv: 'iv',
        user: mockUser,
      } as Vault;

      const mockSecret = {
        id: 1,
        publicId: mockSecretId,
        name: 'my-secret',
        version: 1,
        latest: true,
      } as Secret;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.findOne as any).mockResolvedValue(mockSecret);
      (SecretRepository.save as any).mockImplementation((secret: Secret) => {
        secret.createdAt = new Date();
        secret.updatedAt = new Date();
        return Promise.resolve(secret);
      });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Update secret
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          value: 'new-secret-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('my-secret');
      expect(body.version).toBe(2); // Version incremented
      expect(SecretRepository.save).toHaveBeenCalledTimes(2); // Old secret + new secret
    });

    it('should fail when vault not found', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          value: 'new-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });

    it('should fail when secret not found', async () => {
      // Arrange: Mock vault but not secret
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
        kmsProvider: 'local' as const,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          value: 'new-value',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Secret not found');
    });

    it('should fail with missing value field', async () => {
      const mockVaultId = randomUUID();
      const mockSecretId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Update without value
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}/secrets/${mockSecretId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /vaults/:vaultId/secrets', () => {
    it('should successfully delete all versions of a secret by name', async () => {
      // Arrange: Mock vault and secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      const mockSecrets = [
        { id: 1, name: 'my-secret', version: 1 } as Secret,
        { id: 2, name: 'my-secret', version: 2 } as Secret,
      ];

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue(mockSecrets);
      (SecretRepository.delete as any).mockResolvedValue({ affected: 2 });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Delete secret by name
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}/secrets?name=my-secret`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deletedCount).toBe(2);
      expect(body.message).toContain('my-secret');
      expect(SecretRepository.delete).toHaveBeenCalledWith([1, 2]);
    });

    it('should return 0 deleted count when secret name not found', async () => {
      // Arrange: Mock vault but no secrets
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockUser,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (SecretRepository.find as any).mockResolvedValue([]);
      (SecretRepository.delete as any).mockResolvedValue({ affected: 0 });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}/secrets?name=nonexistent`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deletedCount).toBe(0);
    });

    it('should fail when vault not found', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}/secrets?name=my-secret`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });

    it('should fail when vault belongs to different user', async () => {
      // Arrange: Mock vault owned by different user
      const ownerUserId = randomUUID();
      const requestingUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockOwner = {
        id: 1,
        publicId: ownerUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        user: mockOwner,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}/secrets?name=my-secret`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
    });

    it('should fail with missing name query parameter', async () => {
      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Delete without name query param
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}/secrets`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });
});
