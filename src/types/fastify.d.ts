import 'fastify';
import '@fastify/jwt';

export interface VaultPermission {
  vaultId: string;
  canWrite: boolean;
}

export interface UserPayload {
  userId: string;
  roleId?: string;
  vaultPermissions?: VaultPermission[];
  authType: 'password' | 'cidr' | 'token';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: UserPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: UserPayload;
    user: UserPayload;
  }
}
