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
  createRoleResponseSchema,
  getRoleResponseSchema,
  getRolesResponseSchema,
  updateRoleResponseSchema,
  deleteRoleResponseSchema,
  addAuthMethodResponseSchema,
  getAuthMethodsResponseSchema,
  grantVaultAccessResponseSchema,
  getVaultPermissionsResponseSchema,
  getTokensResponseSchema,
  successMessageResponseSchema,
  errorResponseSchema,
} from '../schemas/roles.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // Role CRUD
  fastify.post('/roles', {
    preHandler: authenticate,
    schema: {
      description: 'Create a new role for delegated access',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      body: createRoleSchema,
      response: {
        200: createRoleResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: createRole,
  });

  fastify.get('/roles', {
    preHandler: authenticate,
    schema: {
      description: 'List all roles for the authenticated user',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      response: {
        200: getRolesResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: getRoles,
  });

  fastify.get('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      description: 'Get a specific role by ID',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      response: {
        200: getRoleResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getRole,
  });

  fastify.put('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      description: 'Update role name or description',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      body: updateRoleSchema,
      response: {
        200: updateRoleResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: updateRole,
  });

  fastify.delete('/roles/:roleId', {
    preHandler: authenticate,
    schema: {
      description: 'Delete a role and all associated auth methods',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      response: {
        200: deleteRoleResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: deleteRole,
  });

  // Auth Methods
  fastify.post('/roles/:roleId/auth-methods', {
    preHandler: authenticate,
    schema: {
      description: 'Add CIDR or token authentication method to role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      body: addAuthMethodSchema,
      response: {
        200: addAuthMethodResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: addAuthMethod,
  });

  fastify.get('/roles/:roleId/auth-methods', {
    preHandler: authenticate,
    schema: {
      description: 'List authentication methods for a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      response: {
        200: getAuthMethodsResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getAuthMethods,
  });

  fastify.delete('/roles/:roleId/auth-methods/:id', {
    preHandler: authenticate,
    schema: {
      description: 'Remove an authentication method from a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: authMethodIdParamSchema,
      response: {
        200: successMessageResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: removeAuthMethod,
  });

  // Vault Permissions
  fastify.post('/roles/:roleId/vaults', {
    preHandler: authenticate,
    schema: {
      description: 'Grant vault access to a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      body: grantVaultAccessSchema,
      response: {
        200: grantVaultAccessResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
    handler: grantVaultAccess,
  });

  fastify.get('/roles/:roleId/vaults', {
    preHandler: authenticate,
    schema: {
      description: 'List vault permissions for a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      response: {
        200: getVaultPermissionsResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getVaultPermissions,
  });

  fastify.put('/roles/:roleId/vaults/:vaultId', {
    preHandler: authenticate,
    schema: {
      description: 'Update vault permission (read-only or read-write)',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: vaultPermissionParamSchema,
      body: updateVaultPermissionSchema,
      response: {
        200: grantVaultAccessResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: updateVaultPermission,
  });

  fastify.delete('/roles/:roleId/vaults/:vaultId', {
    preHandler: authenticate,
    schema: {
      description: 'Revoke vault access from a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: vaultPermissionParamSchema,
      response: {
        200: successMessageResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: revokeVaultAccess,
  });

  // Role Tokens
  fastify.get('/roles/:roleId/tokens', {
    preHandler: authenticate,
    schema: {
      description: 'List active tokens for a role',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: roleIdParamSchema,
      response: {
        200: getTokensResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: listTokens,
  });

  fastify.delete('/roles/:roleId/tokens/:tokenId', {
    preHandler: authenticate,
    schema: {
      description: 'Revoke a specific token',
      tags: ['Roles'],
      security: [{ bearerAuth: [] }],
      params: tokenIdParamSchema,
      response: {
        200: successMessageResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: revokeToken,
  });
};

export default fp(routes);
