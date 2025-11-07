import { FastifyRequest, FastifyReply } from 'fastify';
import { LoginRequest, RefreshTokenRequest, RevokeTokenRequest } from '../types/requests';
import { LoginResponse, RefreshTokenResponse, RevokeTokenResponse } from '../types/responses';
import { UserRepository } from '../repositories/user.repository';
import { compareSync } from 'bcrypt'
import { RefreshTokenRepository } from '../repositories/refresh-token.repository';
import { BadRequestError } from '../services/errors';
import { generateAccessToken, generateRefreshToken, formatUserResponse } from '../services/auth.service';

export async function login(
  request: FastifyRequest<{ Body: LoginRequest }>,
  reply: FastifyReply
): Promise<LoginResponse> {
  const user = await UserRepository.findOne({
    where: { email: request.body.email }
  });

  if (!user) {
    throw new BadRequestError('Invalid email or password');
  }

  if (!compareSync(request.body.password, user.password)) {
    throw new BadRequestError('Invalid email or password');
  }

  const accessToken = generateAccessToken(user, request.server);
  const refreshToken = await generateRefreshToken(user);

  return reply.send({
    accessToken,
    refreshToken: refreshToken.token,
    user: formatUserResponse(user)
  });
}

export async function refresh(
  request: FastifyRequest<{ Body: RefreshTokenRequest }>,
  reply: FastifyReply
): Promise<RefreshTokenResponse> {
  const oldRefreshToken = await RefreshTokenRepository.findOne({
    where: {
      token: request.body.refreshToken
    },
    relations: ['user']
  });

  if (!oldRefreshToken) {
    throw new BadRequestError('Invalid refresh token');
  }

  const user = oldRefreshToken.user;
  const accessToken = generateAccessToken(user, request.server);
  const newRefreshToken = await generateRefreshToken(user);

  // Delete the old refresh token
  await RefreshTokenRepository.delete({ id: oldRefreshToken.id });

  return reply.send({
    accessToken,
    refreshToken: newRefreshToken.token,
    user: formatUserResponse(user)
  });
}

export async function revoke(
  request: FastifyRequest<{ Body: RevokeTokenRequest }>,
  reply: FastifyReply
): Promise<RevokeTokenResponse> {
  const { refreshToken } = request.body;

  if (refreshToken) {
    await RefreshTokenRepository.delete({ token: refreshToken });
    return reply.send({ message: 'Refresh token revoked successfully' });
  }

  const tokens = await RefreshTokenRepository.find({
    where: {
      user: { publicId: request.user.userId }
    }
  });

  await RefreshTokenRepository.delete(tokens.map(token => token.id));

  return reply.send({ message: 'All refresh tokens revoked successfully' });
}
