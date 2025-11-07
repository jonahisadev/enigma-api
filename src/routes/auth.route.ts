import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { login, refresh, revoke } from '../controllers/auth.controller';
import { loginSchema, refreshTokenSchema, revokeTokenSchema } from '../schemas/auth.schema';
import { authenticate } from '../middleware/auth.middleware';

const routes = async (fastify: FastifyInstance) => {
  // POST /accounts/login - Login to account
  fastify.post('/accounts/login', {
    schema: {
      body: loginSchema,
    },
    handler: login,
  });

  // POST /accounts/login/refresh - Refresh access token
  fastify.post('/accounts/login/refresh', {
    schema: {
      body: refreshTokenSchema,
    },
    handler: refresh,
  });

  // POST /accounts/login/revoke - Revoke refresh token(s)
  fastify.post('/accounts/login/revoke', {
    preHandler: authenticate,
    schema: {
      body: revokeTokenSchema,
    },
    handler: revoke,
  });
};

export default fp(routes);
