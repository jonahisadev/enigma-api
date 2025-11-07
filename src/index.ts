import "dotenv/config";
import Fastify from "fastify";
import root from "./routes/root";

const fastify = Fastify({
  logger: true,
});

fastify.register(root);

const main = async () => {
  const port = parseInt(process.env.PORT || "3000");
  await fastify.listen({ host: "0.0.0.0", port });
};

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
