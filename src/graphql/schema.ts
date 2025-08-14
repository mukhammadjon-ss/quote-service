export const typeDefs = `
  type Quote {
    id: String!
    content: String!
    author: String!
    tags: [String!]!
    length: Int!
    likes: Int!
    source: String!
    fetchedAt: String!
    similarity: Float
  }

  type QuoteSearchResult {
    quotes: [Quote!]!
    total: Int!
    page: Int!
    totalPages: Int!
  }

  input QuoteFilters {
    author: String
    tags: [String!]
    minLength: Int
    maxLength: Int
    minLikes: Int
  }

  input PaginationOptions {
    page: Int
    limit: Int
    sortBy: String
    sortOrder: String
  }

  type Query {
    randomQuote(userId: String): Quote!
    quote(id: String!): Quote
    similarQuotes(id: String!, limit: Int): [Quote!]!
    searchQuotes(
      query: String
      filters: QuoteFilters
      options: PaginationOptions
    ): QuoteSearchResult!
    popularQuotes(limit: Int): [Quote!]!
  }

  type Mutation {
    likeQuote(id: String!, userId: String!): Quote!
    unlikeQuote(id: String!, userId: String!): Quote!
  }
`;

export const resolvers = {
  Query: {
    randomQuote: async (_: any, args: any, context: any) => {
      return context.quoteService.getRandomQuote(args.userId);
    },

    quote: async (_: any, args: any, context: any) => {
      return context.quoteService.getQuoteById(args.id);
    },

    similarQuotes: async (_: any, args: any, context: any) => {
      return context.quoteService.getSimilarQuotes(args.id, args.limit);
    },

    searchQuotes: async (_: any, args: any, context: any) => {
      return context.quoteService.searchQuotes(
        args.query,
        args.filters,
        args.options
      );
    },

    popularQuotes: async (_: any, args: any, context: any) => {
      return context.quoteService.getPopularQuotes(args.limit);
    },
  },

  Mutation: {
    likeQuote: async (_: any, args: any, context: any) => {
      return context.quoteService.likeQuote(args.id, args.userId);
    },

    unlikeQuote: async (_: any, args: any, context: any) => {
      return context.quoteService.unlikeQuote(args.id, args.userId);
    },
  },
};
