import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { buildAuthTestApp } from '../auth-helper';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { Vault } from '../../models/vault.model';
import { RoleAuthMethod } from '../../models/role_auth_method.model';
import { RoleVaultPermission } from '../../models/role_vault_permission.model';
import { RoleToken } from '../../models/role_token.model';
import rolesRoute from '../../routes/roles.route';

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

jest.mock('../../repositories/role.repository', () => ({
  RoleRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../repositories/vault.repository', () => ({
  VaultRepository: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../repositories/role-auth-method.repository', () => ({
  RoleAuthMethodRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../repositories/role-vault-permission.repository', () => ({
  RoleVaultPermissionRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../repositories/role-token.repository', () => ({
  RoleTokenRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

// Mock the token creation service
jest.mock('../../services/auth-methods/token', () => ({
  createToken: jest.fn(),
}));

// Mock the CIDR validation service
jest.mock('../../services/auth-methods/cidr', () => ({
  validateCidrs: jest.fn(),
}));

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid-' + Math.random().toString(36).substring(7),
}));

import { UserRepository } from '../../repositories/user.repository';
import { RoleRepository } from '../../repositories/role.repository';
import { VaultRepository } from '../../repositories/vault.repository';
import { RoleAuthMethodRepository } from '../../repositories/role-auth-method.repository';
import { RoleVaultPermissionRepository } from '../../repositories/role-vault-permission.repository';
import { RoleTokenRepository } from '../../repositories/role-token.repository';
import { createToken } from '../../services/auth-methods/token';
import { validateCidrs } from '../../services/auth-methods/cidr';

describe('Role Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAuthTestApp();
    // Register role routes
    await app.register(rolesRoute);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /roles', () => {
    it('should successfully create a role with valid data', async () => {
      // Arrange
      const mockUserId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
        name: 'Test User',
        email: 'test@example.com',
      } as User;

      const mockRole = {
        id: 1,
        publicId: randomUUID(),
        name: 'test-role',
        description: 'Test role description',
        user: mockUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (UserRepository.findOne as any).mockResolvedValue(mockUser);
      (RoleRepository.findOne as any).mockResolvedValue(null); // No existing role
      (RoleRepository.save as any).mockImplementation((role: Role) => {
        role.createdAt = new Date();
        role.updatedAt = new Date();
        return Promise.resolve({ ...mockRole, ...role });
      });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'test-role',
          description: 'Test role description',
        },
      });

      // Assert
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('publicId');
      expect(body.name).toBe('test-role');
      expect(body.description).toBe('Test role description');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('updatedAt');

      expect(UserRepository.findOne).toHaveBeenCalledWith({
        where: { publicId: mockUserId },
      });
      expect(RoleRepository.save).toHaveBeenCalled();
    });

    it('should fail when user not found', async () => {
      const mockUserId = randomUUID();
      (UserRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'test-role',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid user');
    });

    it('should fail when role name already exists for user', async () => {
      const mockUserId = randomUUID();
      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const existingRole = {
        id: 1,
        publicId: randomUUID(),
        name: 'test-role',
      } as Role;

      (UserRepository.findOne as any).mockResolvedValue(mockUser);
      (RoleRepository.findOne as any).mockResolvedValue(existingRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'test-role',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('already exists');
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: mockRoleId,
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'test-role',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Not authorized to create roles');
    });

    it('should fail without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/roles',
        payload: {
          name: 'test-role',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /roles', () => {
    it('should successfully retrieve all user roles', async () => {
      const mockUserId = randomUUID();
      const mockRoles = [
        {
          id: 1,
          publicId: randomUUID(),
          name: 'role-1',
          description: 'Description 1',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Role,
        {
          id: 2,
          publicId: randomUUID(),
          name: 'role-2',
          description: 'Description 2',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Role,
      ];

      (RoleRepository.find as any).mockResolvedValue(mockRoles);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.roles).toHaveLength(2);
      expect(body.roles[0].name).toBe('role-1');
      expect(body.roles[1].name).toBe('role-2');

      expect(RoleRepository.find).toHaveBeenCalledWith({
        where: { user: { publicId: mockUserId } },
      });
    });

    it('should return empty array when user has no roles', async () => {
      const mockUserId = randomUUID();
      (RoleRepository.find as any).mockResolvedValue([]);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.roles).toHaveLength(0);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'cidr',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/roles',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /roles/:roleId', () => {
    it('should successfully retrieve role by ID', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultPermission = {
        id: 1,
        publicId: randomUUID(),
        canWrite: true,
      } as RoleVaultPermission;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: 'Test description',
        vaultPermissions: [mockVaultPermission],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.publicId).toBe(mockRoleId);
      expect(body.name).toBe('test-role');
      expect(body.description).toBe('Test description');
      expect(body.vaultIds).toHaveLength(1);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('No role found');
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PUT /roles/:roleId', () => {
    it('should successfully update role name and description', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'old-name',
        description: 'old description',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleRepository.save as any).mockImplementation((role: Role) => Promise.resolve(role));

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'new-name',
          description: 'new description',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('new-name');
      expect(body.description).toBe('new description');

      expect(RoleRepository.save).toHaveBeenCalled();
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'new-name',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          name: 'new-name',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /roles/:roleId', () => {
    it('should successfully delete role', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleRepository.delete as any).mockResolvedValue({ affected: 1 });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('deleted successfully');

      expect(RoleRepository.delete).toHaveBeenCalledWith(mockRole.id);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'cidr',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /roles/:roleId/auth-methods', () => {
    it('should successfully add token auth method', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      const mockTokenResponse = {
        id: 1,
        publicId: randomUUID(),
        token: 'test-token-xyz',
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
      };

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (createToken as any).mockResolvedValue(mockTokenResponse);
      (RoleAuthMethodRepository.save as any).mockImplementation((method: RoleAuthMethod) => {
        method.createdAt = new Date();
        return Promise.resolve(method);
      });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'token',
          config: {
            name: 'github-actions',
            lifetime: '30d',
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.authType).toBe('token');
      expect(body.token).toBe('test-token-xyz');
      expect(body).toHaveProperty('expiresAt');
      expect(body).toHaveProperty('publicId');

      expect(createToken).toHaveBeenCalledWith({
        role: mockRole,
        name: 'github-actions',
        lifetime: '30d',
      });
    });

    it('should successfully add CIDR auth method', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (validateCidrs as any).mockReturnValue(true);
      (RoleAuthMethodRepository.save as any).mockImplementation((method: RoleAuthMethod) => {
        method.createdAt = new Date();
        return Promise.resolve(method);
      });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'cidr',
          config: {
            allowedCidrs: ['10.0.1.0/24', '192.168.1.0/24'],
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.authType).toBe('cidr');
      expect(body.config.allowedCidrs).toHaveLength(2);
      expect(body).toHaveProperty('publicId');

      expect(validateCidrs).toHaveBeenCalledWith(['10.0.1.0/24', '192.168.1.0/24']);
    });

    it('should fail with invalid CIDR blocks', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (validateCidrs as any).mockReturnValue(false);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'cidr',
          config: {
            allowedCidrs: ['invalid-cidr'],
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('invalid');
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'token',
          config: {
            name: 'test',
            lifetime: '30d',
          },
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail with missing token configuration', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'token',
          config: {},
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Missing token auth method configuration');
    });

    it('should fail with missing CIDR configuration', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'cidr',
          config: {},
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Missing CIDR auth method configuration');
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${randomUUID()}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          authType: 'token',
          config: {
            name: 'test',
            lifetime: '30d',
          },
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /roles/:roleId/auth-methods', () => {
    it('should successfully retrieve all auth methods for role', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockRole = {
        id: 1,
        publicId: mockRoleId,
      } as Role;

      const mockAuthMethods = [
        {
          id: 1,
          publicId: randomUUID(),
          authType: 'cidr' as const,
          config: { allowedCidrs: ['10.0.0.0/8'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RoleAuthMethod,
        {
          id: 2,
          publicId: randomUUID(),
          authType: 'token' as const,
          config: { lifetime: '30d' },
          tokens: [{ name: 'github-actions' } as RoleToken],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as RoleAuthMethod,
      ];

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue(mockAuthMethods);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.authMethods).toHaveLength(2);
      expect(body.authMethods[0].authType).toBe('cidr');
      expect(body.authMethods[1].authType).toBe('token');
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${randomUUID()}/auth-methods`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /roles/:roleId/auth-methods/:id', () => {
    it('should successfully remove auth method', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockAuthMethodId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
      } as Role;

      const mockAuthMethod = {
        id: 1,
        publicId: mockAuthMethodId,
        authType: 'cidr' as const,
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.findOne as any).mockResolvedValue(mockAuthMethod);
      (RoleAuthMethodRepository.delete as any).mockResolvedValue({ affected: 1 });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/auth-methods/${mockAuthMethodId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('removed successfully');

      expect(RoleAuthMethodRepository.delete).toHaveBeenCalledWith(mockAuthMethod.id);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockAuthMethodId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/auth-methods/${mockAuthMethodId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when auth method not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockAuthMethodId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/auth-methods/${mockAuthMethodId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'cidr',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${randomUUID()}/auth-methods/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /roles/:roleId/vaults', () => {
    it('should successfully grant vault access to role', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: {} as User,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'test-vault',
      } as Vault;

      const mockPermission = {
        id: 1,
        publicId: randomUUID(),
        role: mockRole,
        vault: mockVault,
        canWrite: true,
      } as RoleVaultPermission;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (VaultRepository.findOne as any).mockResolvedValue(mockVault);
      (RoleVaultPermissionRepository.save as any).mockResolvedValue(mockPermission);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          vaultId: mockVaultId,
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('granted');

      expect(RoleVaultPermissionRepository.save).toHaveBeenCalled();
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          vaultId: mockVaultId,
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when vault not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: {} as User,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (VaultRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          vaultId: mockVaultId,
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('vault');
    });

    it('should fail when permission already exists', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
      } as Vault;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        vaultPermissions: [{ id: mockVault.id } as RoleVaultPermission],
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (VaultRepository.findOne as any).mockResolvedValue(mockVault);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          vaultId: mockVaultId,
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('already exists');
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${randomUUID()}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          vaultId: randomUUID(),
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /roles/:roleId/vaults', () => {
    it('should successfully retrieve vault permissions for role', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      const mockVault1 = {
        id: 1,
        publicId: randomUUID(),
        name: 'vault-1',
      } as Vault;

      const mockVault2 = {
        id: 2,
        publicId: randomUUID(),
        name: 'vault-2',
      } as Vault;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        vaultPermissions: [
          {
            id: 1,
            vault: mockVault1,
            canWrite: true,
          } as RoleVaultPermission,
          {
            id: 2,
            vault: mockVault2,
            canWrite: false,
          } as RoleVaultPermission,
        ],
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.vaultPermissions).toHaveLength(2);
      expect(body.vaultPermissions[0].vaultName).toBe('vault-1');
      expect(body.vaultPermissions[0].canWrite).toBe(true);
      expect(body.vaultPermissions[1].canWrite).toBe(false);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${randomUUID()}/vaults`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PUT /roles/:roleId/vaults/:vaultId', () => {
    it('should successfully update vault permission', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      const mockPermission = {
        id: 1,
        publicId: randomUUID(),
        canWrite: false,
      } as RoleVaultPermission;

      (RoleVaultPermissionRepository.findOne as any).mockResolvedValue(mockPermission);
      (RoleVaultPermissionRepository.save as any).mockResolvedValue({ ...mockPermission, canWrite: true });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${mockRoleId}/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('updated successfully');

      expect(RoleVaultPermissionRepository.save).toHaveBeenCalled();
    });

    it('should fail when permission not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      (RoleVaultPermissionRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${mockRoleId}/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'cidr',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/roles/${randomUUID()}/vaults/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          canWrite: true,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /roles/:roleId/vaults/:vaultId', () => {
    it('should successfully revoke vault access', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      const mockPermission = {
        id: 1,
        publicId: randomUUID(),
      } as RoleVaultPermission;

      (RoleVaultPermissionRepository.findOne as any).mockResolvedValue(mockPermission);
      (RoleVaultPermissionRepository.delete as any).mockResolvedValue({ affected: 1 });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('revoked successfully');

      expect(RoleVaultPermissionRepository.delete).toHaveBeenCalledWith(mockPermission.id);
    });

    it('should fail when permission not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockVaultId = randomUUID();

      (RoleVaultPermissionRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/vaults/${mockVaultId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${randomUUID()}/vaults/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /roles/:roleId/tokens', () => {
    it('should successfully list all tokens for role', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      const mockToken1 = {
        publicId: randomUUID(),
        name: 'github-actions',
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: false,
        createdAt: new Date(),
      } as RoleToken;

      const mockToken2 = {
        publicId: randomUUID(),
        name: 'ci-cd',
        expiresAt: DateTime.now().plus({ days: 60 }).toJSDate(),
        revoked: true,
        createdAt: new Date(),
      } as RoleToken;

      const mockAuthMethod = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken1],
      } as RoleAuthMethod;

      const mockAuthMethod2 = {
        id: 2,
        authType: 'token' as const,
        tokens: [mockToken2],
      } as RoleAuthMethod;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        authMethods: [mockAuthMethod, mockAuthMethod2],
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/tokens`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tokens).toHaveLength(2);
      expect(body.tokens[0].name).toBe('github-actions');
      expect(body.tokens[0].revoked).toBe(false);
      expect(body.tokens[1].name).toBe('ci-cd');
      expect(body.tokens[1].revoked).toBe(true);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${mockRoleId}/tokens`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'token',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: `/roles/${randomUUID()}/tokens`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('DELETE /roles/:roleId/tokens/:tokenId', () => {
    it('should successfully revoke token', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockTokenId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
      } as Role;

      const mockToken = {
        id: 1,
        publicId: mockTokenId,
        revoked: false,
      } as RoleToken;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleTokenRepository.findOne as any).mockResolvedValue(mockToken);
      (RoleTokenRepository.save as any).mockResolvedValue({ ...mockToken, revoked: true });

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/tokens/${mockTokenId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('revoked successfully');

      expect(RoleTokenRepository.save).toHaveBeenCalled();
    });

    it('should fail when token not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockTokenId = randomUUID();

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleTokenRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/tokens/${mockTokenId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when role not found', async () => {
      const mockUserId = randomUUID();
      const mockRoleId = randomUUID();
      const mockTokenId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const accessToken = app.jwt.sign({ userId: mockUserId, authType: 'password' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${mockRoleId}/tokens/${mockTokenId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should fail when authenticated with role-based auth', async () => {
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({
        userId: mockUserId,
        roleId: randomUUID(),
        authType: 'cidr',
        vaultPermissions: [],
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/roles/${randomUUID()}/tokens/${randomUUID()}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
