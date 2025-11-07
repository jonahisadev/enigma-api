import { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import root from "../../routes/root.route";

describe("Root routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(root);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /", () => {
    it("should return 200 with version", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        ok: true,
        version: 1,
      });
    });
  });

  describe("GET /health", () => {
    it("should return 200 with uptime", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveProperty("uptime");
    });
  });
});
