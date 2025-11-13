import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { serializerCompiler, validatorCompiler, ZodTypeProvider, jsonSchemaTransform } from "fastify-type-provider-zod";
import { AppDataSource } from "./data-source";
import root from "./routes/root.route";
import auth from "./routes/auth.route";
import invites from "./routes/invite.route";
import vaults from "./routes/vaults.route";
import secrets from "./routes/secrets.route";
import roles from "./routes/roles.route";
import roleAuth from "./routes/role-auth.route";
import { errorHandler } from "./services/errors";
import { loadSecret } from "./utils/config";

const fastify = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

// Set Zod validator and serializer
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Register Swagger/OpenAPI
fastify.register(swagger, {
  openapi: {
    info: {
      title: "Enigma Secrets Management API",
      description: "API for securely storing and managing encryption keys and secrets across multiple vaults with KMS integration support",
      version: "0.2.0",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT access token obtained from login endpoints",
        },
      },
    },
    tags: [
      { name: "Authentication", description: "Account authentication and token management" },
      { name: "Invites", description: "User invite and signup operations" },
      { name: "Vaults", description: "Vault management operations" },
      { name: "Secrets", description: "Secret storage and retrieval operations" },
      { name: "Roles", description: "Role-based access control management" },
      { name: "Role Authentication", description: "Role-based authentication endpoints" },
    ],
  },
  transform: jsonSchemaTransform,
});

// Register Swagger UI
fastify.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
  staticCSP: true,
});

// Load JWT secret from environment or file
const jwtSecret = loadSecret('JWT_SECRET', 'JWT_SECRET_FILE') || 'your-secret-key-change-this-in-production';

// Register JWT plugin
fastify.register(jwt, {
  secret: jwtSecret,
  sign: {
    expiresIn: '15m', // Access token expires in 15 minutes
  },
});

// Register routes
fastify.register(root);
fastify.register(auth);
fastify.register(invites);
fastify.register(vaults);
fastify.register(secrets);
fastify.register(roles);
fastify.register(roleAuth);

// Error handler
fastify.setErrorHandler(errorHandler);

const main = async () => {
  try {
    // Initialize database connection
    await AppDataSource.initialize();
    fastify.log.info("Database connection initialized");

    // Generate OpenAPI spec (available after all routes are registered)
    await fastify.ready();

    // Start server
    const port = parseInt(process.env.PORT || "3000");
    await fastify.listen({ host: "0.0.0.0", port });

    fastify.log.info("Swagger UI available at http://localhost:" + port + "/docs");
    fastify.log.info("OpenAPI spec available at http://localhost:" + port + "/docs/json");
    fastify.log.info("OpenAPI YAML available at http://localhost:" + port + "/docs/yaml");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
