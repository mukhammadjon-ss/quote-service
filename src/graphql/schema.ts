import { register } from "module";
import { QuoteFilters } from "../models/quote.model";
import { logger } from "../utils/logger";

export const schema = `
type Quote {
    id: ID!
    content: String!
    author: String!
    likes: Int!
    source: String!
  }
type QuoteConnection {
    quotes: [Quote!]!
    pagination: Pagination!
  }

 type Pagination {
    currentPage: Int!
    totalPages: Int!
    totalItems: Int!
    hasNext: Boolean!
    hasPrev: Boolean!
  }

   enum QuoteSortBy {
    LIKES
    LENGTH
    FETCHED_AT
    AUTHOR
  }

  enum SortOrder {
    ASC
    DESC
  }

   type QuoteLikeResponse {
    id: ID!
    likes: Int!
    isLikedByUser: Boolean!
  }

  input RegisterInput {
    email: String!
    username: String!
    password: String!
    firstName: String!
    lastName: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type User {
    id: ID!
    email: String!
    username: String!
    firstName: String!
    lastName: String!
    role: String!
    isActive: Boolean!
    createdAt: String!
  }

  type AuthResponse {
    user: User!
    accessToken: String!
    refreshToken: String!
    expiresIn: Int!
  }

  type Query {
    hello(name: String): String
    getRandomQuote(userId: String): Quote
    getQuote(id: ID!): Quote
    searchQuotes(
      query: String
      minLength: Int
      maxLength: Int
      minLikes: Int
      page: Int = 1
      limit: Int = 10
      sortBy: QuoteSortBy = LIKES
      sortOrder: SortOrder = DESC
    ): QuoteConnection!
    getPopularQuotes(limit: Int = 10): [Quote!]!
    getSimilarQuotes(id: ID!, limit: Int = 5): [Quote!]!

    # Auth queries
    me: User

  }

  type Mutation {
    # Auth mutations
    register(input: RegisterInput!): AuthResponse!
    login(input: LoginInput!): AuthResponse!
    # logout: SuccessResponse!
    
    # Quote mutations (require authentication)
    likeQuote(id: ID!): QuoteLikeResponse!
    unlikeQuote(id: ID!): QuoteLikeResponse!
  }
`;

export const resolvers = {
  Query: {
    getRandomQuote: async (
      _: any,
      { userId }: { userId?: string },
      context: any
    ) => {
      return context.quoteService.getRandomQuote(userId);
    },
    getQuote: async (_: any, { id }: { id: string }, context: any) => {
      try {
        const userId = context.user?.userId;
        const quote = await context.quoteService.getQuoteById(id, userId);

        if (!quote) {
          throw new Error("Quote not found");
        }

        return quote;
      } catch (error) {
        throw new Error(`Failed to get quote: ${(error as Error).message}`);
      }
    },

    searchQuotes: async (
      _: any,
      {
        query,
        author,
        minLength,
        maxLength,
        minLikes,
      }: {
        query: string;
        author?: string;
        minLength?: number;
        maxLength?: number;
        minLikes?: number;
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: string;
      },
      context: any
    ) => {
      try {
        const filters: QuoteFilters = {
          author,
          minLength,
          maxLength,
          minLikes,
        };
        const paginationOptions = {
          page: 1,
          limit: 10,
          sortBy: "likes",
          sortOrder: "desc",
        };
        return await context.quoteService.searchQuotes(
          query,
          filters,
          paginationOptions
        );
      } catch (error) {
        throw new Error(`Failed to search quotes: ${(error as Error).message}`);
      }
    },
    getPopularQuotes: async (
      _: any,
      { limit = 10 }: { limit?: number },
      context: any
    ) => {
      try {
        return await context.quoteService.getPopularQuotes(limit);
      } catch (error) {
        throw new Error(
          `Failed to get popular quotes: ${(error as Error).message}`
        );
      }
    },
    getSimilarQuotes: async (
      _: any,
      { id, limit = 5 }: { id: string; limit?: number },
      context: any
    ) => {
      try {
        return await context.quoteService.getSimilarQuotes(id, limit);
      } catch (error) {
        throw new Error(
          `Failed to get similar quotes: ${(error as Error).message}`
        );
      }
    },
    me: async (_: any, __: any, context: any) => {
      try {
        if (!context.user) {
          throw new Error("User not authenticated");
        }
        return await context.authService.getUserProfile(context.user.userId);
      } catch (error) {
        throw new Error(
          `Failed to fetch user profile: ${(error as Error).message}`
        );
      }
    },
  },
  Mutation: {
    likeQuote: async (_: any, { id }: { id: string }, context: any) => {
      try {
        // console.log(context.user);
        const userId = context.user?.userId;
        return await context.quoteService.likeQuote(id, userId);
      } catch (error) {
        throw new Error(`Failed to like quote: ${(error as Error).message}`);
      }
    },

    unlikeQuote: async (_: any, { id }: { id: string }, context: any) => {
      try {
        // console.log(context.user);
        const userId = context.user?.userId;
        return await context.quoteService.unlikeQuote(id, userId);
      } catch (error) {
        throw new Error(`Failed to like quote: ${(error as Error).message}`);
      }
    },
    register: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const authResponse = await context.authService.register(input);
        return authResponse;
      } catch (error) {
        throw new Error(`Registration failed: ${(error as Error).message}`);
      }
    },
    login: async (
      _: any,
      { input }: { input: { email: string; password: string } },
      context: any
    ) => {
      try {
        const authResponse = await context.authService.login(input);
        return authResponse;
      } catch (error) {
        throw new Error(`Login failed: ${(error as Error).message}`);
      }
    }
  },
};
