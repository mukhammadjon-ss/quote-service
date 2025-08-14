import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import mercurius from "mercurius";
import { schema, resolvers } from "../graphql/schema";
import { QuoteService } from "../services/quote.service";
import { AuthService } from "../services/auth.service";
import { GraphQLAuthUtils } from "../utils/auth.utils";
import { logger } from "../utils/logger";

export default fp(async function graphqlPlugin(fastify: FastifyInstance) {
  await fastify.register(mercurius, {
    schema,
    resolvers,
    context: async (request, reply) => {
      const context = {
        quoteService: new QuoteService(fastify.mongo.db),
        authService: new AuthService(fastify.mongo.db),
        request,
        reply,
        user: undefined
      };
      try {
        context.user = await GraphQLAuthUtils.getUserFromContext(context);
      } catch (error) {
        logger.warn("Failed to extract user from context", {
          error: (error as Error).message,
        });
      }
      return context;
    },
    ide: true,
  });
});

export { fp as graphqlPlugin };
