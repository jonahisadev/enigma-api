import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refresh_token.model';
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserPayload } from '../types/fastify';

/**
 * Generate a JWT access token for a user
 */
export function generateAccessToken(user: User, fastify: FastifyInstance): string {
  return fastify.jwt.sign({
    userId: user.publicId,
    authType: 'password',
  });
}

/**
 * Generate and persist a new refresh token for a user
 */
export async function generateRefreshToken(user: User): Promise<RefreshToken> {
  const refreshToken = new RefreshToken();
  refreshToken.token = randomBytes(64).toString('hex');
  refreshToken.user = user;
  refreshToken.expiresAt = DateTime.now().plus({ days: 30 }).toJSDate();

  return await RefreshTokenRepository.save(refreshToken);
}

/**
 * Format user data for API responses
 */
export function formatUserResponse(user: User) {
  return {
    publicId: user.publicId,
    name: user.name,
    email: user.email,
  };
}

export interface VaultAccessResult {
  isAdmin: boolean;
  hasAccess: boolean;
  canWrite: boolean;
}

export function getVaultAccess(payload: UserPayload, vaultId: string): VaultAccessResult {
  if (payload.authType === 'password') {
    return { isAdmin: true, hasAccess: true, canWrite: true };
  }

  const permission = payload.vaultPermissions?.find(vp => vp.vaultId === vaultId);
  if (permission) {
    return { isAdmin: false, hasAccess: true, canWrite: permission.canWrite };
  }

  return { isAdmin: false, hasAccess: false, canWrite: false };
}
