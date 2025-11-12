import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createVault, getVault, getVaults, updateVault, deleteVault } from '../controllers/vaults.controller';
import {
  createVaultSchema,
  updateVaultSchema,
  vaultIdParamSchema,
  createVaultResponseSchema,
  getVaultResponseSchema,
  getVaultsResponseSchema,
  updateVaultResponseSchema,
  deleteVaultResponseSchema,
  errorResponseSchema
} from '../schemas/vaults.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /vaults - Create a vault for user
  fastify.post('/vaults', {
    preHandler: authenticate,
    schema: {
      description: 'Create a new vault',
      tags: ['Vaults'],
      security: [{ bearerAuth: [] }],
      body: createVaultSchema,
      response: {
        200: createVaultResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: createVault,
  });

  // GET /vaults - Get all vaults associated with account
  fastify.get('/vaults', {
    preHandler: authenticate,
    schema: {
      description: 'List all vaults accessible to the authenticated user',
      tags: ['Vaults'],
      security: [{ bearerAuth: [] }],
      response: {
        200: getVaultsResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: getVaults,
  });

  // GET /vaults/:id - Get a vault by public ID
  fastify.get('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      description: 'Get a specific vault by ID',
      tags: ['Vaults'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      response: {
        200: getVaultResponseSchema,
        401: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getVault,
  });

  // PUT /vaults/:id - Update a vault
  fastify.put('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      description: 'Update vault name',
      tags: ['Vaults'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      body: updateVaultSchema,
      response: {
        200: updateVaultResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: updateVault,
  });

  // DELETE /vaults/:id - Delete a vault
  fastify.delete('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      description: 'Delete a vault and all its secrets (requires password authentication)',
      tags: ['Vaults'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      response: {
        200: deleteVaultResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: deleteVault,
  });
};

export default fp(routes);
