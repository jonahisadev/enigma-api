import { FastifyInstance } from "fastify";
import * as helper from "../helper";

describe("Root routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await helper.build();
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
