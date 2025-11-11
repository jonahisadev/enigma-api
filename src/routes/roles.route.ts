import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  addAuthMethod,
  getAuthMethods,
  removeAuthMethod,
  grantVaultAccess,
  getVaultPermissions,
  updateVaultPermission,
  revokeVaultAccess,
  listTokens,
  revokeToken,
} from '../controllers/roles.controller';
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  addAuthMethodSchema,
  authMethodIdParamSchema,
  grantVaultAccessSchema,
  updateVaultPermissionSchema,
  vaultPermissionParamSchema,
  tokenIdParamSchema,
} from '../schemas/roles.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // Role CRUD
  fastify.post('/roles', {
    preHandler: authenticate,
    schema: {
      body: createRoleSchema,
    },
    handler: createRole,
  });

  fastify.get('/roles', {
    preHandler: authenticate,
    handler: getRoles,
  });

  fastify.get('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
    },
    handler: getRole,
  });

  fastify.put('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
      body: updateRoleSchema,
    },
    handler: updateRole,
  });

  fastify.delete('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
    },
    handler: deleteRole,
  });

  // Auth Methods
  fastify.post('/roles/:roleId/auth-methods', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
      body: addAuthMethodSchema,
    },
    handler: addAuthMethod,
  });

  fastify.get('/roles/:roleId/auth-methods', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
    },
    handler: getAuthMethods,
  });

  fastify.delete('/roles/:roleId/auth-methods/:id', {
    preHandler: authenticate,
    schema: {
      params: authMethodIdParamSchema,
    },
    handler: removeAuthMethod,
  });

  // Vault Permissions
  fastify.post('/roles/:roleId/vaults', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
      body: grantVaultAccessSchema,
    },
    handler: grantVaultAccess,
  });

  fastify.get('/roles/:roleId/vaults', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
    },
    handler: getVaultPermissions,
  });

  fastify.put('/roles/:roleId/vaults/:vaultId', {
    preHandler: authenticate,
    schema: {
      params: vaultPermissionParamSchema,
      body: updateVaultPermissionSchema,
    },
    handler: updateVaultPermission,
  });

  fastify.delete('/roles/:roleId/vaults/:vaultId', {
    preHandler: authenticate,
    schema: {
      params: vaultPermissionParamSchema,
    },
    handler: revokeVaultAccess,
  });

  // Role Tokens
  fastify.get('/roles/:roleId/tokens', {
    preHandler: authenticate,
    schema: {
      params: roleIdParamSchema,
    },
    handler: listTokens,
  });

  fastify.delete('/roles/:roleId/tokens/:tokenId', {
    preHandler: authenticate,
    schema: {
      params: tokenIdParamSchema,
    },
    handler: revokeToken,
  });
};

export default fp(routes);
