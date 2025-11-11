import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { cidrLogin, tokenLogin } from '../controllers/role-auth.controller';
import { roleIdParamSchema, tokenLoginSchema } from '../schemas/roles.schema';

const routes = async (fastify: FastifyInstance) => {
  // CIDR-based authentication
  fastify.post('/roles/:roleId/login/cidr', {
    schema: {
      params: roleIdParamSchema,
    },
    handler: cidrLogin,
  });

  // Token-based authentication
  fastify.post('/roles/:roleId/login/token', {
    schema: {
      params: roleIdParamSchema,
      body: tokenLoginSchema,
    },
    handler: tokenLogin,
  });
};

export default fp(routes);
