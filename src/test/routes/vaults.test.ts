import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { buildAuthTestApp } from '../auth-helper';
import { User } from '../../models/user.model';
import { Vault } from '../../models/vault.model';
import vaultRoutes from '../../routes/vaults.route';

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
jest.mock('../../repositories/user.repository', () => ({
  UserRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

jest.mock('../../repositories/vault.repository', () => ({
  VaultRepository: {
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

import { UserRepository } from '../../repositories/user.repository';
import { VaultRepository } from '../../repositories/vault.repository';
import { KmsFactory } from '../../services/kms/factory';

describe('Vault Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAuthTestApp();
    // Register vault routes
    await app.register(vaultRoutes);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup KMS Factory mock
    const mockGenerateVaultKey = jest.fn();
    (mockGenerateVaultKey as any).mockResolvedValue({
      key: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
      iv: Buffer.from('0123456789abcdef', 'hex'),
    });

    (KmsFactory.createProvider as jest.Mock).mockReturnValue({
      generateVaultKey: mockGenerateVaultKey,
    });
  });

  describe('POST /vaults', () => {
    it('should successfully create a vault with valid data', async () => {
      // Arrange: Mock user lookup and vault save
      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        kmsProvider: 'local' as const,
        accountKeyId: 'test-key-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      (UserRepository.findOne as any).mockResolvedValue(mockUser);

      // Mock VaultRepository.save to add timestamps to the passed vault
      (VaultRepository.save as any).mockImplementation((vault: Vault) => {
        vault.createdAt = new Date();
        vault.updatedAt = new Date();
        return Promise.resolve(vault);
      });

      // Generate access token for authorization
      const accessToken = app.jwt.sign({ userId: mockUser.publicId, authType: 'password' });

      // Act: Create vault request
      const response = await app.inject({
        method: 'POST',
        url: '/vaults',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'My Vault',
        },
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('publicId');
      expect(body.name).toBe('My Vault');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');

      // Verify repository methods were called
      expect(UserRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockUser.publicId },
      });
      expect(VaultRepository.save).toHaveBeenCalled();
    });

    it('should fail when user not found', async () => {
      // Arrange: Mock user not found
      (UserRepository.findOne as any).mockResolvedValue(null);

      // Generate access token for non-existent user
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/vaults',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'My Vault',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid request');
    });

    it('should fail with missing name field', async () => {
      // Generate access token
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Create vault without name
      const response = await app.inject({
        method: 'POST',
        url: '/vaults',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });

    it('should fail without authentication', async () => {
      // Act: Create vault without auth header
      const response = await app.inject({
        method: 'POST',
        url: '/vaults',
        payload: {
          name: 'My Vault',
        },
      });

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /vaults/:id', () => {
    it('should successfully retrieve vault by public ID', async () => {
      // Arrange: Mock vault lookup
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'My Vault',
        encryptionKey: 'encrypted-key',
        keyIv: 'iv',
        user: mockUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      // Generate access token for the vault owner
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Get vault request
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.publicId).toBe(mockVaultId);
      expect(body.name).toBe('My Vault');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');

      // Verify repository was called with correct params
      expect(VaultRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockVaultId },
        relations: ['user'],
      });
    });

    it('should fail when vault does not exist', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
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
        name: 'Other User Vault',
        user: mockOwner,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      // Generate access token for different user
      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });

    it('should fail without authentication', async () => {
      // Act: Get vault without auth header
      const response = await app.inject({
        method: 'GET',
        url: `/vaults/${randomUUID()}`,
      });

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /vaults', () => {
    it('should successfully retrieve all user vaults', async () => {
      // Arrange: Mock multiple vaults
      const mockUserId = randomUUID();
      const mockVaults = [
        {
          id: 1,
          publicId: randomUUID(),
          name: 'Vault 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Vault,
        {
          id: 2,
          publicId: randomUUID(),
          name: 'Vault 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Vault,
      ];

      (VaultRepository.find as any).mockResolvedValue(mockVaults);

      // Generate access token
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: List vaults request
      const response = await app.inject({
        method: 'GET',
        url: '/vaults',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vaults).toHaveLength(2);
      expect(body.vaults[0].name).toBe('Vault 1');
      expect(body.vaults[1].name).toBe('Vault 2');

      // Verify repository was called correctly
      expect(VaultRepository.find).toHaveBeenCalledWith({
        where: { user: { publicId: mockUserId } },
      });
    });

    it('should return empty array when user has no vaults', async () => {
      // Arrange: Mock empty vault list
      (VaultRepository.find as any).mockResolvedValue([]);

      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'GET',
        url: '/vaults',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vaults).toHaveLength(0);
      expect(body.vaults).toEqual([]);
    });

    it('should fail without authentication', async () => {
      // Act: List vaults without auth header
      const response = await app.inject({
        method: 'GET',
        url: '/vaults',
      });

      // Assert
      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /vaults/:id', () => {
    it('should successfully update vault name', async () => {
      // Arrange: Mock vault lookup and save
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'Old Name',
        user: mockUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Vault;

      const updatedVault = {
        ...mockVault,
        name: 'New Name',
      };

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (VaultRepository.save as any).mockResolvedValue(updatedVault);

      // Generate access token for vault owner
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Update vault request
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'New Name',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.publicId).toBe(mockVaultId);
      expect(body.name).toBe('New Name');

      // Verify repository methods were called
      expect(VaultRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockVaultId },
        relations: ['user'],
      });
      expect(VaultRepository.save).toHaveBeenCalled();
    });

    it('should fail when vault does not exist', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'New Name',
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
        name: 'Other User Vault',
        user: mockOwner,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      // Generate access token for different user
      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'New Name',
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });

    it('should fail with missing name field', async () => {
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act: Update vault without name
      const response = await app.inject({
        method: 'PUT',
        url: `/vaults/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /vaults/:id', () => {
    it('should successfully delete vault', async () => {
      // Arrange: Mock vault lookup and delete
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'My Vault',
        user: mockUser,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (VaultRepository.delete as any).mockResolvedValue({ affected: 1 });

      // Generate access token for vault owner
      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act: Delete vault request
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Vault deleted successfully');

      // Verify repository methods were called
      expect(VaultRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockVaultId },
        relations: ['user'],
      });
      expect(VaultRepository.delete).toHaveBeenCalledWith(mockVault.id);
    });

    it('should fail when vault does not exist', async () => {
      // Arrange: Mock vault not found
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const mockVaultId = randomUUID();
      const accessToken = app.jwt.sign({ userId: randomUUID(), authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
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
        name: 'Other User Vault',
        user: mockOwner,
      } as Vault;

      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      // Generate access token for different user
      const accessToken = app.jwt.sign({ userId: requestingUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'DELETE',
        url: `/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Assert
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Vault not found');
    });
  });
});
