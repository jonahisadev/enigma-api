import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createSecret, getSecret, getSecrets, updateSecret, deleteSecret } from '../controllers/secrets.controller';
import {
  createSecretSchema,
  updateSecretSchema,
  secretParamsSchema,
  vaultIdParamSchema,
  getSecretsQuerySchema,
  deleteSecretQuerySchema,
  createSecretResponseSchema,
  getSecretResponseSchema,
  getSecretsResponseSchema,
  updateSecretResponseSchema,
  deleteSecretResponseSchema,
  errorResponseSchema
} from '../schemas/secrets.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /vaults/:vaultId/secrets - Create a secret in a vault
  fastify.post('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      description: 'Create a new secret in a vault',
      tags: ['Secrets'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      body: createSecretSchema,
      response: {
        200: createSecretResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
    handler: createSecret,
  });

  // GET /vaults/:vaultId/secrets - Get all secrets for a vault (can filter by name)
  fastify.get('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      description: 'List all secrets in a vault (optionally filter by name or get latest versions only)',
      tags: ['Secrets'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      querystring: getSecretsQuerySchema,
      response: {
        200: getSecretsResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getSecrets,
  });

  // GET /vaults/:vaultId/secrets/:secretId - Get a secret by public ID
  fastify.get('/vaults/:vaultId/secrets/:secretId', {
    preHandler: authenticate,
    schema: {
      description: 'Get a specific secret by ID (decrypted)',
      tags: ['Secrets'],
      security: [{ bearerAuth: [] }],
      params: secretParamsSchema,
      response: {
        200: getSecretResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: getSecret,
  });

  // PUT /vaults/:vaultId/secrets/:secretId - Update a secret value (creates new version)
  fastify.put('/vaults/:vaultId/secrets/:secretId', {
    preHandler: authenticate,
    schema: {
      description: 'Update a secret value (creates a new version)',
      tags: ['Secrets'],
      security: [{ bearerAuth: [] }],
      params: secretParamsSchema,
      body: updateSecretSchema,
      response: {
        200: updateSecretResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: updateSecret,
  });

  // DELETE /vaults/:vaultId/secrets - Delete a secret by name (deletes all versions)
  fastify.delete('/vaults/:vaultId/secrets', {
    preHandler: authenticate,
    schema: {
      description: 'Delete all versions of a secret by name',
      tags: ['Secrets'],
      security: [{ bearerAuth: [] }],
      params: vaultIdParamSchema,
      querystring: deleteSecretQuerySchema,
      response: {
        200: deleteSecretResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
    handler: deleteSecret,
  });
};

export default fp(routes);
