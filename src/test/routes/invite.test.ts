import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { buildAuthTestApp } from '../auth-helper';
import { Invite } from '../../models/invite.model';
import { User } from '../../models/user.model';

// Mock AppDataSource first (before repositories are imported)
jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      findOne: jest.fn(),
      save: jest.fn(),
    })),
  },
}));

// Mock the repositories
jest.mock('../../repositories/invite.repository', () => ({
  InviteRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

jest.mock('../../repositories/user.repository', () => ({
  UserRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
  },
}));

// Mock KmsFactory
jest.mock('../../services/kms/factory', () => ({
  KmsFactory: {
    createAccountKey: jest.fn(),
  },
}));

import { InviteRepository } from '../../repositories/invite.repository';
import { UserRepository } from '../../repositories/user.repository';
import { KmsFactory } from '../../services/kms/factory';

describe('Invite Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAuthTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /invites', () => {
    it('should successfully create user with valid invite', async () => {
      // Arrange: Mock invite lookup
      const mockInvite = {
        id: 1,
        publicId: randomUUID(),
        inviteCode: 'ABCDEF',
        email: 'test@example.com',
        kmsProvider: 'local' as const,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invite;

      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        kmsProvider: 'local' as const,
        accountKeyId: 'not-needed',
        createdAt: new Date(),
        updatedAt: new Date(),
        vaults: [],
        refreshTokens: [],
      } as User;

      (InviteRepository.findOne as any).mockResolvedValue(mockInvite);
      (InviteRepository.save as any).mockResolvedValue({ ...mockInvite, usedAt: new Date() });
      (UserRepository.save as any).mockResolvedValue(mockUser);
      (KmsFactory.createAccountKey as any).mockResolvedValue('not-needed');

      // Act: Accept invite
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'abcdef', // lowercase to test case-insensitivity
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user).toMatchObject({
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(body.user.publicId).toBeDefined();

      // Verify repository methods were called
      expect(InviteRepository.findOne).toHaveBeenCalledWith({
        where: { inviteCode: 'ABCDEF' },
      });
      expect(KmsFactory.createAccountKey).toHaveBeenCalledWith('local');
      expect(UserRepository.save).toHaveBeenCalled();
      expect(InviteRepository.save).toHaveBeenCalled();

      // Verify invite was marked as used
      const savedInvite = (InviteRepository.save as any).mock.calls[0][0];
      expect(savedInvite.usedAt).toBeInstanceOf(Date);
    });

    it('should fail with invalid invite code', async () => {
      // Arrange: Mock invite not found
      (InviteRepository.findOne as any).mockResolvedValue(null);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'WRONGX', // Valid format but doesn't exist
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid invite code');
    });

    it('should fail with already used invite', async () => {
      // Arrange: Mock invite that has been used
      const mockInvite = {
        id: 1,
        publicId: randomUUID(),
        inviteCode: 'ABCDEF',
        email: 'test@example.com',
        kmsProvider: 'local' as const,
        usedAt: new Date(), // Already used
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invite;

      (InviteRepository.findOne as any).mockResolvedValue(mockInvite);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('already been used');
    });

    it('should fail with email mismatch', async () => {
      // Arrange: Mock invite for different email
      const mockInvite = {
        id: 1,
        publicId: randomUUID(),
        inviteCode: 'ABCDEF',
        email: 'invited@example.com',
        kmsProvider: 'local' as const,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invite;

      (InviteRepository.findOne as any).mockResolvedValue(mockInvite);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'different@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('does not match invite');
    });

    it('should handle email case-insensitivity', async () => {
      // Arrange: Mock invite with lowercase email
      const mockInvite = {
        id: 1,
        publicId: randomUUID(),
        inviteCode: 'ABCDEF',
        email: 'test@example.com',
        kmsProvider: 'local' as const,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invite;

      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'TEST@EXAMPLE.COM',
        password: 'hashed-password',
        kmsProvider: 'local' as const,
        accountKeyId: 'not-needed',
        createdAt: new Date(),
        updatedAt: new Date(),
        vaults: [],
        refreshTokens: [],
      } as User;

      (InviteRepository.findOne as any).mockResolvedValue(mockInvite);
      (InviteRepository.save as any).mockResolvedValue({ ...mockInvite, usedAt: new Date() });
      (UserRepository.save as any).mockResolvedValue(mockUser);
      (KmsFactory.createAccountKey as any).mockResolvedValue('not-needed');

      // Act: Use uppercase email
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'TEST@EXAMPLE.COM',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
    });

    it('should fail with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with missing name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          inviteCode: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with missing invite code', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'not-an-email',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with invalid invite code format (too short)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABC',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with invalid invite code format (contains numbers)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABC123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail with password shorter than 8 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'short',
          inviteCode: 'ABCDEF',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should successfully create user with AWS KMS provider', async () => {
      // Arrange: Mock invite with AWS provider
      const mockInvite = {
        id: 1,
        publicId: randomUUID(),
        inviteCode: 'ABCDEF',
        email: 'test@example.com',
        kmsProvider: 'aws' as const,
        usedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Invite;

      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        kmsProvider: 'aws' as const,
        accountKeyId: 'aws-key-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        vaults: [],
        refreshTokens: [],
      } as User;

      (InviteRepository.findOne as any).mockResolvedValue(mockInvite);
      (InviteRepository.save as any).mockResolvedValue({ ...mockInvite, usedAt: new Date() });
      (UserRepository.save as any).mockResolvedValue(mockUser);
      (KmsFactory.createAccountKey as any).mockResolvedValue('aws-key-123');

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/invites',
        payload: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'password123',
          inviteCode: 'ABCDEF',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      expect(KmsFactory.createAccountKey).toHaveBeenCalledWith('aws');
    });
  });
});
