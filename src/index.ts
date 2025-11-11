import "dotenv/config";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import { AppDataSource } from "./data-source";
import root from "./routes/root.route";
import auth from "./routes/auth.route";
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

    // Start server
    const port = parseInt(process.env.PORT || "3000");
    await fastify.listen({ host: "0.0.0.0", port });
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
