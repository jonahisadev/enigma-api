import { FastifyInstance } from "fastify";
import Fastify from "fastify";
import fp from "fastify-plugin";
import AutoLoad from "@fastify/autoload";
import { join } from "path";

async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(
    fp(async (fastify: FastifyInstance) => {
      await fastify.register(AutoLoad, {
        dir: join(__dirname, "../routes"),
        options: {},
      });
    }),
  );

  return app;
}

export { build };
