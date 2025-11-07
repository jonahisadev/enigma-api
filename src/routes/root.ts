import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

const routes = async (fastify: FastifyInstance) => {
  fastify.get("/", async (req, res) =>
    res.status(200).send({
      ok: true,
      version: 1,
    }),
  );

  fastify.get("/health", async (req, res) => {
    res.status(200).send({
      ok: true,
      message: "Service is healthy",
      uptime: process.uptime(),
    });
  });
};

export default fp(routes);
