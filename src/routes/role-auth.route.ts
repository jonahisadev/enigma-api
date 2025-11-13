import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { cidrLogin, tokenLogin } from '../controllers/role-auth.controller';
import {
  roleIdParamSchema,
  tokenLoginSchema,
  roleLoginResponseSchema,
  errorResponseSchema
} from '../schemas/roles.schema';

const routes = async (fastify: FastifyInstance) => {
  // CIDR-based authentication
  fastify.post('/roles/:roleId/login/cidr', {
    schema: {
      description: 'Authenticate using IP-based CIDR validation',
      tags: ['Role Authentication'],
      params: roleIdParamSchema,
      response: {
        200: roleLoginResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
    handler: cidrLogin,
  });

  // Token-based authentication
  fastify.post('/roles/:roleId/login/token', {
    schema: {
      description: 'Authenticate using a static token',
      tags: ['Role Authentication'],
      params: roleIdParamSchema,
      body: tokenLoginSchema,
      response: {
        200: roleLoginResponseSchema,
        401: errorResponseSchema,
      },
    },
    handler: tokenLogin,
  });
};

export default fp(routes);
