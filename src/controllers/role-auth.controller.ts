import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenLoginRequest } from '../types/requests';
import { RoleLoginResponse } from '../types/responses';

// TODO: Implement CIDR-based login
// 1. Find role by publicId from params
// 2. Find RoleAuthMethod where roleId matches and authType = 'cidr'
// 3. Extract client IP from request.ip or X-Forwarded-For header
// 4. Validate IP is within one of the allowedCidrs (use ipaddr.js library)
// 5. Query RoleVaultPermissionRepository to get accessible vaults with canWrite flags
// 6. Generate JWT with:
//    - userId: role.user.publicId
//    - roleId: role.publicId
//    - vaultPermissions: [{ vaultId, canWrite }, ...]
//    - authType: 'cidr'
// 7. Return RoleLoginResponse with accessToken
// 8. Throw UnauthorizedError if IP not in allowed ranges or auth method not found
export async function cidrLogin(
  _request: FastifyRequest<{ Params: { roleId: string } }>,
  _reply: FastifyReply
): Promise<RoleLoginResponse> {
  throw new Error('Not implemented');
}

// TODO: Implement token-based login
// 1. Find role by publicId from params
// 2. Find RoleAuthMethod where roleId matches and authType = 'token'
// 3. Extract token from request body
// 4. Query RoleTokenRepository for tokens belonging to this auth method
// 5. For each token:
//    a. Compare request token with tokenHash using bcrypt.compare()
//    b. Check if token is expired (expiresAt < now)
//    c. Check if token is revoked
// 6. If valid token found:
//    a. Query RoleVaultPermissionRepository to get accessible vaults
//    b. Generate JWT with userId, roleId, vaultPermissions, authType: 'token'
//    c. Return RoleLoginResponse with accessToken
// 7. Throw UnauthorizedError if token invalid, expired, revoked, or not found
export async function tokenLogin(
  _request: FastifyRequest<{ Params: { roleId: string }; Body: TokenLoginRequest }>,
  _reply: FastifyReply
): Promise<RoleLoginResponse> {
  throw new Error('Not implemented');
}
