import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { randomUUID, createHash } from 'crypto';
import { DateTime } from 'luxon';
import { buildAuthTestApp } from '../auth-helper';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { RoleAuthMethod } from '../../models/role_auth_method.model';
import { RoleToken } from '../../models/role_token.model';
import { Vault } from '../../models/vault.model';
import { RoleVaultPermission } from '../../models/role_vault_permission.model';
import roleAuthRoute from '../../routes/role-auth.route';

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
jest.mock('../../repositories/role.repository', () => ({
  RoleRepository: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../repositories/role-auth-method.repository', () => ({
  RoleAuthMethodRepository: {
    find: jest.fn(),
  },
}));

// Mock CIDR validation service
jest.mock('../../services/auth-methods/cidr', () => ({
  validateAddress: jest.fn(),
}));

import { RoleRepository } from '../../repositories/role.repository';
import { RoleAuthMethodRepository } from '../../repositories/role-auth-method.repository';
import { validateAddress } from '../../services/auth-methods/cidr';

describe('Role Auth Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAuthTestApp();
    // Register role auth routes
    await app.register(roleAuthRoute);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /roles/:roleId/login/cidr', () => {
    it('should successfully login with valid IP address', async () => {
      // Arrange
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
        name: 'Test User',
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'test-vault',
      } as Vault;

      const mockVaultPermission = {
        id: 1,
        vault: mockVault,
        canWrite: true,
      } as RoleVaultPermission;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        user: mockUser,
        vaultPermissions: [mockVaultPermission],
      } as Role;

      const mockAuthMethods = [
        {
          id: 1,
          authType: 'cidr' as const,
          config: { allowedCidrs: ['10.0.1.0/24'] },
        } as RoleAuthMethod,
      ];

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue(mockAuthMethods);
      (validateAddress as any).mockReturnValue(true);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
        headers: {
          'x-forwarded-for': '10.0.1.50',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');

      // Verify JWT contains correct information
      const decoded = app.jwt.decode(body.accessToken) as any;
      expect(decoded.userId).toBe(mockUserId);
      expect(decoded.roleId).toBe(mockRoleId);
      expect(decoded.authType).toBe('cidr');
      expect(decoded.vaultPermissions).toHaveLength(1);
      expect(decoded.vaultPermissions[0].vaultId).toBe(mockVaultId);
      expect(decoded.vaultPermissions[0].canWrite).toBe(true);

      expect(validateAddress).toHaveBeenCalledWith('10.0.1.50', ['10.0.1.0/24']);
    });

    it('should use x-forwarded-for header when present', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockAuthMethods = [
        {
          id: 1,
          authType: 'cidr' as const,
          config: { allowedCidrs: ['192.168.1.0/24'] },
        } as RoleAuthMethod,
      ];

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue(mockAuthMethods);
      (validateAddress as any).mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(validateAddress).toHaveBeenCalledWith('192.168.1.100', ['192.168.1.0/24']);
    });

    it('should combine CIDR blocks from multiple auth methods', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockAuthMethods = [
        {
          id: 1,
          authType: 'cidr' as const,
          config: { allowedCidrs: ['10.0.1.0/24', '10.0.2.0/24'] },
        } as RoleAuthMethod,
        {
          id: 2,
          authType: 'cidr' as const,
          config: { allowedCidrs: ['192.168.1.0/24'] },
        } as RoleAuthMethod,
      ];

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue(mockAuthMethods);
      (validateAddress as any).mockReturnValue(true);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
        headers: {
          'x-forwarded-for': '192.168.1.50',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(validateAddress).toHaveBeenCalledWith('192.168.1.50', [
        '10.0.1.0/24',
        '10.0.2.0/24',
        '192.168.1.0/24',
      ]);
    });

    it('should fail when role not found', async () => {
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Role not found');
    });

    it('should fail when client IP is rejected', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockAuthMethods = [
        {
          id: 1,
          authType: 'cidr' as const,
          config: { allowedCidrs: ['10.0.1.0/24'] },
        } as RoleAuthMethod,
      ];

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue(mockAuthMethods);
      (validateAddress as any).mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
        headers: {
          'x-forwarded-for': '192.168.1.100',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Client IP rejected');
    });

    it('should fail when no CIDR auth methods exist for role', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([]);
      (validateAddress as any).mockReturnValue(false);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/cidr`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Client IP rejected');
    });
  });

  describe('POST /roles/:roleId/login/token', () => {
    it('should successfully login with valid token', async () => {
      // Arrange
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();
      const mockVaultId = randomUUID();
      const tokenData = 'test-token-xyz';
      const tokenHash = createHash('sha256').update(tokenData).digest('base64');

      const mockUser = {
        id: 1,
        publicId: mockUserId,
        name: 'Test User',
      } as User;

      const mockVault = {
        id: 1,
        publicId: mockVaultId,
        name: 'test-vault',
      } as Vault;

      const mockVaultPermission = {
        id: 1,
        vault: mockVault,
        canWrite: false,
      } as RoleVaultPermission;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        user: mockUser,
        vaultPermissions: [mockVaultPermission],
      } as Role;

      const mockToken = {
        id: 1,
        publicId: randomUUID(),
        tokenHash: tokenHash,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: false,
      } as RoleToken;

      const mockAuthMethod = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken],
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([mockAuthMethod]);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: tokenData,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');

      // Verify JWT contains correct information
      const decoded = app.jwt.decode(body.accessToken) as any;
      expect(decoded.userId).toBe(mockUserId);
      expect(decoded.roleId).toBe(mockRoleId);
      expect(decoded.authType).toBe('token');
      expect(decoded.vaultPermissions).toHaveLength(1);
      expect(decoded.vaultPermissions[0].vaultId).toBe(mockVaultId);
      expect(decoded.vaultPermissions[0].canWrite).toBe(false);
    });

    it('should fail when role not found', async () => {
      const mockRoleId = randomUUID();

      (RoleRepository.findOne as any).mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: 'test-token',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Role not found');
    });

    it('should fail with invalid token', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const validTokenHash = createHash('sha256').update('valid-token').digest('base64');
      const mockToken = {
        id: 1,
        tokenHash: validTokenHash,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: false,
      } as RoleToken;

      const mockAuthMethod = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken],
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([mockAuthMethod]);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid token');
    });

    it('should fail with expired token', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();
      const tokenData = 'test-token';
      const tokenHash = createHash('sha256').update(tokenData).digest('base64');

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockToken = {
        id: 1,
        tokenHash: tokenHash,
        expiresAt: DateTime.now().minus({ days: 1 }).toJSDate(), // Expired
        revoked: false,
      } as RoleToken;

      const mockAuthMethod = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken],
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([mockAuthMethod]);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: tokenData,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid token');
    });

    it('should fail with revoked token', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();
      const tokenData = 'test-token';
      const tokenHash = createHash('sha256').update(tokenData).digest('base64');

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockToken = {
        id: 1,
        tokenHash: tokenHash,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: true, // Revoked
      } as RoleToken;

      const mockAuthMethod = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken],
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([mockAuthMethod]);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: tokenData,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid token');
    });

    it('should fail when no token auth methods exist for role', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: 'test-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid token');
    });

    it('should fail with missing token in payload', async () => {
      const mockRoleId = randomUUID();

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should match token from multiple auth methods', async () => {
      const mockRoleId = randomUUID();
      const mockUserId = randomUUID();
      const tokenData = 'test-token-2';
      const tokenHash1 = createHash('sha256').update('test-token-1').digest('base64');
      const tokenHash2 = createHash('sha256').update('test-token-2').digest('base64');

      const mockUser = {
        id: 1,
        publicId: mockUserId,
      } as User;

      const mockRole = {
        id: 1,
        publicId: mockRoleId,
        name: 'test-role',
        description: '',
        user: mockUser,
        vaultPermissions: [],
        authMethods: [],
        tokens: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Role;

      const mockToken1 = {
        id: 1,
        tokenHash: tokenHash1,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: false,
      } as RoleToken;

      const mockToken2 = {
        id: 2,
        tokenHash: tokenHash2,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        revoked: false,
      } as RoleToken;

      const mockAuthMethod1 = {
        id: 1,
        authType: 'token' as const,
        tokens: [mockToken1],
      } as RoleAuthMethod;

      const mockAuthMethod2 = {
        id: 2,
        authType: 'token' as const,
        tokens: [mockToken2],
      } as RoleAuthMethod;

      (RoleRepository.findOne as any).mockResolvedValue(mockRole);
      (RoleAuthMethodRepository.find as any).mockResolvedValue([mockAuthMethod1, mockAuthMethod2]);

      const response = await app.inject({
        method: 'POST',
        url: `/roles/${mockRoleId}/login/token`,
        payload: {
          token: tokenData,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');
    });
  });
});
