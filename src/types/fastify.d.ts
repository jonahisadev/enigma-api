import 'fastify';
import '@fastify/jwt';

export interface VaultPermission {
  vaultId: string;
  canWrite: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      userId: string;
      roleId?: string;
      vaultPermissions?: VaultPermission[];
      authType: 'password' | 'cidr' | 'token';
    };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string;
      roleId?: string;
      vaultPermissions?: VaultPermission[];
      authType: 'password' | 'cidr' | 'token';
    };
    user: {
      userId: string;
      roleId?: string;
      vaultPermissions?: VaultPermission[];
      authType: 'password' | 'cidr' | 'token';
    };
  }
}
