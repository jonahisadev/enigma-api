import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { hashSync } from 'bcrypt';
import { randomUUID } from 'crypto';
import { DateTime } from 'luxon';
import { buildAuthTestApp } from '../auth-helper';
import { User } from '../../models/user.model';
import { RefreshToken } from '../../models/refresh_token.model';

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

jest.mock('../../repositories/refresh-token.repository', () => ({
  RefreshTokenRepository: {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  },
}));

import { UserRepository } from '../../repositories/user.repository';
import { RefreshTokenRepository } from '../../repositories/refresh-token.repository';

describe('Auth Routes', () => {
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

  describe('POST /accounts/login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange: Mock user lookup
      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        password: hashSync('password123', 10),
        kmsProvider: 'local' as const,
        accountKeyId: 'test-key-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        vaults: [],
        refreshTokens: [],
      } as User;

      const mockRefreshToken = {
        id: 1,
        token: randomUUID(),
        user: mockUser,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as RefreshToken;

      (UserRepository.findOne as any).mockResolvedValue(mockUser);
      (RefreshTokenRepository.save as any).mockResolvedValue(mockRefreshToken);

      // Act: Login request
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          email: 'test@example.com',
          password: 'password123',
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.user).toEqual({
        publicId: mockUser.publicId,
        name: 'Test User',
        email: 'test@example.com',
      });

      // Verify repository methods were called
      expect(UserRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(RefreshTokenRepository.save).toHaveBeenCalled();
    });

    it('should fail login with invalid email', async () => {
      // Arrange: Mock user not found
      (UserRepository.findOne as any).mockResolvedValue(null);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'password123',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid email or password');
    });

    it('should fail login with invalid password', async () => {
      // Arrange: Mock user with different password
      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        password: hashSync('correctpassword', 10),
        kmsProvider: 'local' as const,
        accountKeyId: 'test-key-id',
      } as User;

      (UserRepository.findOne as any).mockResolvedValue(mockUser);

      // Act: Login with wrong password
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid email or password');
    });

    it('should fail login with missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail login with missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should fail login with invalid email format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login',
        payload: {
          email: 'not-an-email',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /accounts/login/refresh', () => {
    it('should successfully refresh access token with valid refresh token', async () => {
      // Arrange: Mock refresh token lookup
      const mockUser = {
        id: 1,
        publicId: randomUUID(),
        name: 'Test User',
        email: 'test@example.com',
        password: hashSync('password123', 10),
        kmsProvider: 'local' as const,
        accountKeyId: 'test-key-id',
      } as User;

      const oldTokenValue = randomUUID();
      const mockOldRefreshToken = {
        id: 1,
        token: oldTokenValue,
        user: mockUser,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
      } as RefreshToken;

      const mockNewRefreshToken = {
        id: 2,
        token: randomUUID(),
        user: mockUser,
        expiresAt: DateTime.now().plus({ days: 30 }).toJSDate(),
      } as RefreshToken;

      (RefreshTokenRepository.findOne as any).mockResolvedValue(mockOldRefreshToken);
      (RefreshTokenRepository.save as any).mockResolvedValue(mockNewRefreshToken);
      (RefreshTokenRepository.delete as any).mockResolvedValue({ affected: 1 });

      // Act: Refresh token request
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/refresh',
        payload: {
          refreshToken: oldTokenValue,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.refreshToken).not.toBe(oldTokenValue); // New token issued
      expect(body.user).toEqual({
        publicId: mockUser.publicId,
        name: 'Test User',
        email: 'test@example.com',
      });

      // Verify old token was deleted
      expect(RefreshTokenRepository.delete).toHaveBeenCalledWith({ id: mockOldRefreshToken.id });

      // Verify new token was saved
      expect(RefreshTokenRepository.save).toHaveBeenCalled();
    });

    it('should fail refresh with invalid token', async () => {
      // Arrange: Mock token not found
      (RefreshTokenRepository.findOne as any).mockResolvedValue(null);

      // Act
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/refresh',
        payload: {
          refreshToken: 'invalid-token-12345',
        },
      });

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.reason).toContain('Invalid refresh token');
    });

    it('should fail refresh with missing token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /accounts/login/revoke', () => {
    it('should revoke specific refresh token', async () => {
      // Arrange: Mock token deletion
      const tokenValue = randomUUID();
      (RefreshTokenRepository.delete as any).mockResolvedValue({ affected: 1 });

      // Generate access token for authorization
      const mockUserId = randomUUID();
      const accessToken = app.jwt.sign({ userId: mockUserId });

      // Act: Revoke the specific token
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/revoke',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          refreshToken: tokenValue,
        },
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Refresh token revoked successfully');

      // Verify delete was called with the token
      expect(RefreshTokenRepository.delete).toHaveBeenCalledWith({ token: tokenValue });
    });

    it('should revoke all refresh tokens for user when no specific token provided', async () => {
      // Arrange: Mock finding and deleting multiple tokens
      const mockUserId = randomUUID();
      const mockTokens = [
        { id: 1, token: randomUUID() } as RefreshToken,
        { id: 2, token: randomUUID() } as RefreshToken,
      ];

      (RefreshTokenRepository.find as any).mockResolvedValue(mockTokens);
      (RefreshTokenRepository.delete as any).mockResolvedValue({ affected: 2 });

      // Generate access token for authorization
      const accessToken = app.jwt.sign({ userId: mockUserId });

      // Act: Revoke all tokens
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/revoke',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('All refresh tokens revoked successfully');

      // Verify tokens were looked up and deleted
      expect(RefreshTokenRepository.find).toHaveBeenCalledWith({
        where: { user: { publicId: mockUserId } },
      });
      expect(RefreshTokenRepository.delete).toHaveBeenCalledWith([1, 2]);
    });

    it('should fail revoke without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/revoke',
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('should fail revoke with invalid access token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/accounts/login/revoke',
        headers: {
          authorization: 'Bearer invalid-token-xyz',
        },
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
