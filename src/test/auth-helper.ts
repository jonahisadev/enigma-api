import { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import auth from '../routes/auth.route';
import invites from '../routes/invite.route';
import { errorHandler } from '../services/errors';

export async function buildAuthTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  // Set Zod validator and serializer
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register error handler BEFORE routes
  app.setErrorHandler(errorHandler);

  // Register JWT plugin
  await app.register(jwt, {
    secret: 'test-secret-key',
    sign: {
      expiresIn: '15m',
    },
  });

  // Register routes
  await app.register(auth);
  await app.register(invites);

  return app;
}
