import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { acceptInvite } from '../controllers/invite.controller';
import {
  acceptInviteSchema,
  acceptInviteResponseSchema,
  errorResponseSchema
} from '../schemas/invite.schema';

const routes = async (fastify: FastifyInstance) => {
  // POST /invites - Accept invite and create user account
  fastify.post('/invites', {
    schema: {
      description: 'Accept an invite code and create a new user account',
      tags: ['Invites'],
      body: acceptInviteSchema,
      response: {
        200: acceptInviteResponseSchema,
        400: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
    handler: acceptInvite,
  });
};

export default fp(routes);
