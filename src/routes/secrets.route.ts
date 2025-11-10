import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createSecret, getSecret, getSecrets, updateSecret, deleteSecret } from '../controllers/secrets.controller';
import { createSecretSchema, updateSecretSchema, secretParamsSchema, vaultIdParamSchema, getSecretsQuerySchema, deleteSecretQuerySchema } from '../schemas/secrets.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /vaults/:vaultId/secrets - Create a secret in a vault
  fastify.post('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
      body: createSecretSchema,
    },
    handler: createSecret,
  });

  // GET /vaults/:vaultId/secrets - Get all secrets for a vault (can filter by name)
  fastify.get('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
      querystring: getSecretsQuerySchema,
    },
    handler: getSecrets,
  });

  // GET /vaults/:vaultId/secrets/:secretId - Get a secret by public ID
  fastify.get('/vaults/:vaultId/secrets/:secretId', {
    preHandler: authenticate,
    schema: {
      params: secretParamsSchema,
    },
    handler: getSecret,
  });

  // PUT /vaults/:vaultId/secrets/:secretId - Update a secret value (creates new version)
  fastify.put('/vaults/:vaultId/secrets/:secretId', {
    preHandler: authenticate,
    schema: {
      params: secretParamsSchema,
      body: updateSecretSchema,
    },
    handler: updateSecret,
  });

  // DELETE /vaults/:vaultId/secrets - Delete a secret by name (deletes all versions)
  fastify.delete('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      params: vaultIdParamSchema,
      querystring: deleteSecretQuerySchema,
    },
    handler: deleteSecret,
  });
};

export default fp(routes);
