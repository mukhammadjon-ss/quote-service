import Fastify, { FastifyInstance } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";


const app = Fastify({
    logger: {
        level: "info",
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        },
    },
    ignoreTrailingSlash: true,
}).withTypeProvider<TypeBoxTypeProvider>();

async function buildApp() {
  // Security plugins
  await app.register(helmet);
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(swagger, {
    swagger: {
      info: {
        title: "Quote Service API",
        description:
          "A production-ready quote service with REST and GraphQL APIs",
        version: "1.0.0",
      },
      host: "localhost:3000",
      schemes: ["http", "https"],
      consumes: ["application/json"],
      produces: ["application/json"],
    },
  });
    return app;
}

async function start() {
  try {
    const server = await buildApp();
    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("🚀 Server running on http://localhost:3000");
    console.log("📚 API Documentation: http://localhost:3000/docs");
    console.log("🔍 GraphQL Playground: http://localhost:3000/graphiql");
  } catch (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildApp };