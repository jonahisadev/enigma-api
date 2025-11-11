import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createVault, getVault, getVaults, updateVault, deleteVault } from '../controllers/vaults.controller';
import { createVaultSchema, updateVaultSchema, vaultIdParamSchema } from '../schemas/vaults.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /vaults - Create a vault for user
  fastify.post('/vaults', {
    preHandler: authenticate,
    schema: {
      body: createVaultSchema,
    },
    handler: createVault,
  });

  // GET /vaults - Get all vaults associated with account
  fastify.get('/vaults', {
    preHandler: authenticate,
    handler: getVaults,
  });

  // GET /vaults/:id - Get a vault by public ID
  fastify.get('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
    },
    handler: getVault,
  });

  // PUT /vaults/:id - Update a vault
  fastify.put('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
      body: updateVaultSchema,
    },
    handler: updateVault,
  });

  // DELETE /vaults/:id - Delete a vault
  fastify.delete('/vaults/:id', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
    },
    handler: deleteVault,
  });
};

export default fp(routes);
