import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import mercurius from "mercurius";
import { typeDefs, resolvers } from "../graphql/schema";
import { QuoteService } from "../services/quote.service";

export default fp(async function (fastify: FastifyInstance) {
  await fastify.register(mercurius, {
    schema: typeDefs,
    resolvers,
    context: (request, reply) => {
      return {
        quoteService: new QuoteService(fastify.mongo.db),
      };
    },
    graphiql: true,
    path: "/graphql",
  });
});

export { fp as graphqlPlugin };
