import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Type } from "@sinclair/typebox";
import { QuoteService } from "../services/quote.service";

export async function quoteRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const quoteService = new QuoteService(fastify.mongo.db);

  // Get random quote
  fastify.get(
    "/quotes/random",
    {
      schema: {
        summary: "Get a random quote",
        description:
          "Returns a random quote, prioritizing popular quotes for new users",
        querystring: Type.Object({
          userId: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              id: Type.String(),
              content: Type.String(),
              author: Type.String(),
              tags: Type.Array(Type.String()),
              length: Type.Number(),
              likes: Type.Number(),
              source: Type.String(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { userId } = request.query as { userId?: string };

      try {
        const quote = await quoteService.getRandomQuote(userId);

        return reply.code(200).send({
          success: true,
          data: quote,
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch random quote",
        });
      }
    }
  );

  // Like a quote
  fastify.post(
    "/quotes/:id/like",
    {
      schema: {
        summary: "Like a quote",
        params: Type.Object({
          id: Type.String(),
        }),
        body: Type.Object({
          userId: Type.String(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };

      try {
        const quote = await quoteService.likeQuote(id, userId);

        return reply.code(200).send({
          success: true,
          data: quote,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Unlike a quote
  fastify.delete(
    "/quotes/:id/like",
    {
      schema: {
        summary: "Unlike a quote",
        params: Type.Object({
          id: Type.String(),
        }),
        body: Type.Object({
          userId: Type.String(),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { userId } = request.body as { userId: string };

      try {
        const quote = await quoteService.unlikeQuote(id, userId);

        return reply.code(200).send({
          success: true,
          data: quote,
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Get similar quotes
  fastify.get(
    "/quotes/:id/similar",
    {
      schema: {
        summary: "Get similar quotes",
        params: Type.Object({
          id: Type.String(),
        }),
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 20 })),
        }),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { limit = 5 } = request.query as { limit?: number };

      try {
        const similarQuotes = await quoteService.getSimilarQuotes(id, limit);

        return reply.code(200).send({
          success: true,
          data: similarQuotes,
        });
      } catch (error: any) {
        return reply.code(404).send({
          success: false,
          error: error.message,
        });
      }
    }
  );

  // Search quotes
  fastify.get(
    "/quotes/search",
    {
      schema: {
        summary: "Search quotes",
        querystring: Type.Object({
          q: Type.Optional(Type.String()),
          author: Type.Optional(Type.String()),
          tags: Type.Optional(Type.String()),
          minLength: Type.Optional(Type.Number()),
          maxLength: Type.Optional(Type.Number()),
          minLikes: Type.Optional(Type.Number()),
          page: Type.Optional(Type.Number({ minimum: 1 })),
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
          sortBy: Type.Optional(
            Type.Union([
              Type.Literal("likes"),
              Type.Literal("length"),
              Type.Literal("fetchedAt"),
            ])
          ),
          sortOrder: Type.Optional(
            Type.Union([Type.Literal("asc"), Type.Literal("desc")])
          ),
        }),
      },
    },
    async (request, reply) => {
      const query = request.query as any;

      try {
        const filters = {
          author: query.author,
          tags: query.tags ? query.tags.split(",") : undefined,
          minLength: query.minLength,
          maxLength: query.maxLength,
          minLikes: query.minLikes,
        };

        const options = {
          page: query.page,
          limit: query.limit,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        };

        const result = await quoteService.searchQuotes(
          query.q,
          filters,
          options
        );

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: "Search failed",
        });
      }
    }
  );

  // Get popular quotes
  fastify.get(
    "/quotes/popular",
    {
      schema: {
        summary: "Get popular quotes",
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ minimum: 1, maximum: 50 })),
        }),
      },
    },
    async (request, reply) => {
      const { limit = 10 } = request.query as { limit?: number };

      try {
        const quotes = await quoteService.getPopularQuotes(limit);

        return reply.code(200).send({
          success: true,
          data: quotes,
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch popular quotes",
        });
      }
    }
  );
}
