import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { login, refresh, revoke } from '../controllers/auth.controller';
import {
  loginSchema,
  refreshTokenSchema,
  revokeTokenSchema,
  loginResponseSchema,
  refreshResponseSchema,
  revokeResponseSchema,
  errorResponseSchema
} from '../schemas/auth.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /accounts/login - Login to account
  fastify.post('/accounts/login', {
    schema: {
      description: 'Authenticate with email and password',
      tags: ['Authentication'],
      body: loginSchema,
      response: {
        200: loginResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: login,
  });

  // POST /accounts/login/refresh - Refresh access token
  fastify.post('/accounts/login/refresh', {
    schema: {
      description: 'Refresh access token using a refresh token',
      tags: ['Authentication'],
      body: refreshTokenSchema,
      response: {
        200: refreshResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: refresh,
  });

  // POST /accounts/login/revoke - Revoke refresh token(s)
  fastify.post('/accounts/login/revoke', {
    preHandler: authenticate,
    schema: {
      description: 'Revoke one or all refresh tokens',
      tags: ['Authentication'],
      security: [{ bearerAuth: [] }],
      body: revokeTokenSchema,
      response: {
        200: revokeResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: revoke,
  });
};

export default fp(routes);
