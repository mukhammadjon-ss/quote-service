import { MongoClient, Db, Collection, WithId } from "mongodb";
import {
  Quote,
  QuoteWithSimilarity,
  QuoteFilters,
  QuotePaginationOptions,
} from "../models/quote.model";
import { ExternalQuoteService } from "./external-quote.service";
import { SimilarityService } from "./similarity.service";
import { logger } from "../utils/logger";

export class QuoteService {
  private db: Db;
  private collection: Collection<Quote>;
  private externalQuoteService: ExternalQuoteService;
  private similarityService: SimilarityService;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<Quote>("quotes");
    this.externalQuoteService = new ExternalQuoteService();
    this.similarityService = new SimilarityService();
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ author: 1 });
    await this.collection.createIndex({ tags: 1 });
    await this.collection.createIndex({ likes: -1 });
    await this.collection.createIndex({ content: "text", author: "text" });
  }

  async getRandomQuote(userId?: string): Promise<Quote> {
    try {
      // For new users (no userId), prioritize popular quotes
      if (!userId) {
        const popularQuotes = await this.collection
          .find({ likes: { $gte: 5 } })
          .toArray();

        if (popularQuotes.length > 0) {
          const randomIndex = Math.floor(Math.random() * popularQuotes.length);
          return popularQuotes[randomIndex];
        }
      }

      // Try to get from local database first
      const localQuotes = await this.collection.find({}).toArray();

      if (localQuotes.length > 0 && Math.random() > 0.3) {
        // 70% chance to return local quote
        const randomIndex = Math.floor(Math.random() * localQuotes.length);
        return localQuotes[randomIndex];
      }

      // Fetch new quote from external API
      const externalQuote = await this.externalQuoteService.fetchRandomQuote();

      // Store in database if not exists
      await this.collection.updateOne(
        { id: externalQuote.id },
        { $setOnInsert: externalQuote },
        { upsert: true }
      );

      return externalQuote;
    } catch (error: any) {
      logger.error("Error fetching random quote:", error);
      throw new Error("Failed to fetch random quote");
    }
  }

  async likeQuote(quoteId: string, userId: string): Promise<Quote | null> {
    try {
        const result = await this.collection.findOneAndUpdate(
          { id: quoteId, likedBy: { $ne: userId } },
          {
            $inc: { likes: 1 },
            $push: { likedBy: userId },
          },
          { returnDocument: "after" }
        );

        return result || null;
    } catch (error: any) {
        throw new Error("Quote not found or already liked by user");
    }
  }

  async unlikeQuote(quoteId: string, userId: string): Promise<Quote | null> {
    try {
        const result = await this.collection.findOneAndUpdate(
          { id: quoteId, likedBy: userId },
          {
            $inc: { likes: -1 },
            $pull: { likedBy: userId },
          },
          { returnDocument: "after" }
        );

        return result || null;
    } catch (error: any) {
        throw new Error("Quote not found or not liked by user");
    }
  }

  async getSimilarQuotes(
    quoteId: string,
    limit: number = 5
  ): Promise<QuoteWithSimilarity[]> {
    const targetQuote = await this.collection.findOne({ id: quoteId });

    if (!targetQuote) {
      throw new Error("Quote not found");
    }

    const allQuotes = await this.collection
      .find({ id: { $ne: quoteId } })
      .toArray();

    const quotesWithSimilarity = allQuotes
      .map((quote) => ({
        ...quote,
        similarity: this.similarityService.calculateSimilarity(
          targetQuote,
          quote
        ),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return quotesWithSimilarity;
  }

  async searchQuotes(
    query: string,
    filters: QuoteFilters = {},
    options: QuotePaginationOptions = {}
  ): Promise<{
    quotes: Quote[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      sortBy = "likes",
      sortOrder = "desc",
    } = options;

    const filter: any = {};

    if (query) {
      filter.$text = { $search: query };
    }

    if (filters.author) {
      filter.author = new RegExp(filters.author, "i");
    }

    if (filters.tags?.length) {
      filter.tags = { $in: filters.tags };
    }

    if (filters.minLength || filters.maxLength) {
      filter.length = {};
      if (filters.minLength) filter.length.$gte = filters.minLength;
      if (filters.maxLength) filter.length.$lte = filters.maxLength;
    }

    if (filters.minLikes) {
      filter.likes = { $gte: filters.minLikes };
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const [quotes, total] = await Promise.all([
      this.collection
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.collection.countDocuments(filter),
    ]);

    return {
      quotes,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getQuoteById(id: string): Promise<Quote | null> {
    return this.collection.findOne({ id });
  }

  async getPopularQuotes(limit: number = 10): Promise<Quote[]> {
    return this.collection.find({}).sort({ likes: -1 }).limit(limit).toArray();
  }
}
