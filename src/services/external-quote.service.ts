import fetch from "node-fetch";
import { Quote } from "../models/quote.model";
import { logger } from "../utils/logger";

interface QuotableResponse {
  _id: string;
  content: string;
  author: string;
  tags: string[];
  length: number;
}

interface DummyJsonResponse {
  id: number;
  quote: string;
  author: string;
}

export class ExternalQuoteService {
  private readonly quotableUrl = "https://api.quotable.io/random";
  private readonly dummyJsonUrl = "https://dummyjson.com/quotes/random";

  async fetchRandomQuote(): Promise<Quote> {
    const source = Math.random() > 0.5 ? "quotable" : "dummyjson";

    try {
      if (source === "quotable") {
        return await this.fetchFromQuotable();
      } else {
        return await this.fetchFromDummyJson();
      }
    } catch (error: any) {
      logger.error(`Error fetching from ${source}:`, error);

      // Fallback to other source
      try {
        return source === "quotable"
          ? await this.fetchFromDummyJson()
          : await this.fetchFromQuotable();
      } catch (fallbackError: any) {
        logger.error("Both external sources failed:", fallbackError);
        throw new Error("Failed to fetch quote from external sources");
      }
    }
  }

  private async fetchFromQuotable(): Promise<Quote> {
    const response = await fetch(this.quotableUrl);

    if (!response.ok) {
      throw new Error(`Quotable API error: ${response.status}`);
    }

    const data = (await response.json()) as QuotableResponse;

    return {
      id: data._id,
      content: data.content,
      author: data.author,
      tags: data.tags,
      length: data.length,
      likes: 0,
      likedBy: [],
      fetchedAt: new Date(),
      source: "quotable",
    };
  }

  private async fetchFromDummyJson(): Promise<Quote> {
    const response = await fetch(this.dummyJsonUrl);

    if (!response.ok) {
      throw new Error(`DummyJSON API error: ${response.status}`);
    }

    const data = (await response.json()) as DummyJsonResponse;

    return {
      id: `dj-${data.id}`,
      content: data.quote,
      author: data.author,
      tags: [],
      length: data.quote.length,
      likes: 0,
      likedBy: [],
      fetchedAt: new Date(),
      source: "dummyjson",
    };
  }
}
