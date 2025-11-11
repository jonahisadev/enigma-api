import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenLoginRequest } from '../types/requests';
import { RoleLoginResponse } from '../types/responses';
import { RoleRepository } from '../repositories/role.repository';
import { NotFoundError, UnauthorizedError } from '../services/errors';
import { RoleAuthMethodRepository } from '../repositories/role-auth-method.repository';
import { validateAddress } from '../services/auth-methods/cidr';
import { createHash } from 'crypto';

export async function cidrLogin(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<RoleLoginResponse> {
  const { roleId } = request.params;
  const role = await RoleRepository.findOne({
    where: { publicId: roleId },
    relations: ['vaultPermissions', 'vaultPermissions.vault', 'user']
  });

  if (!role) {
    throw new NotFoundError(`Role not found by ID ${roleId}`);
  }

  // Gather CIDR blocks
  const blocks: string[] = [];
  const authMethods = await RoleAuthMethodRepository.find({
    where: {
      role: { id: role.id },
      authType: 'cidr'
    }
  });
  for (const method of authMethods) {
    const config = method.config as { allowedCidrs: string[] };
    blocks.push(...config.allowedCidrs);
  }

  // Validate client IP
  let clientIp = request.ip;
  if (request.headers['x-forwarded-for']) {
    clientIp = request.headers['x-forwarded-for'].toString();
  }

  const valid = validateAddress(clientIp, blocks);
  if (!valid) {
    throw new UnauthorizedError('Client IP rejected');
  }

  const jwt = request.server.jwt.sign({
    userId: role.user.publicId,
    roleId: role.publicId,
    vaultPermissions: role.vaultPermissions.map(vp => ({
      vaultId: vp.vault.publicId,
      canWrite: vp.canWrite
    })),
    authType: 'cidr',
  });

  return reply.status(200).send({
    accessToken: jwt,
  });
}

export async function tokenLogin(
  request: FastifyRequest<{ Params: { roleId: string }; Body: TokenLoginRequest }>,
  reply: FastifyReply
): Promise<RoleLoginResponse> {
  const { roleId } = request.params;
  const role = await RoleRepository.findOne({
    where: { publicId: roleId },
    relations: ['vaultPermissions', 'vaultPermissions.vault', 'user']
  });

  if (!role) {
    throw new NotFoundError(`Role not found by ID ${roleId}`);
  }

  const { token } = request.body;
  const tokenHash = createHash('sha256').update(token).digest('base64');

  const authMethods = await RoleAuthMethodRepository.find({
    where: {
      role: { id: role.id },
      authType: 'token'
    },
    relations: ['tokens']
  });

  const validToken = authMethods.flatMap(method => method.tokens).find(rt => {
    return rt.tokenHash === tokenHash && !rt.revoked && rt.expiresAt > new Date();
  });

  if (!validToken) {
    throw new UnauthorizedError('Invalid token');
  }

  const jwt = request.server.jwt.sign({
    userId: role.user.publicId,
    roleId: role.publicId,
    vaultPermissions: role.vaultPermissions.map(vp => ({
      vaultId: vp.vault.publicId,
      canWrite: vp.canWrite
    })),
    authType: 'token',
  });

  return reply.status(200).send({
    accessToken: jwt,
  });
}
