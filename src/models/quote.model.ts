import { z } from "zod";

export const QuoteSchema = z.object({
  _id: z.string().optional(),
  id: z.string(),
  content: z.string(),
  author: z.string(),
  tags: z.array(z.string()).default([]),
  length: z.number(),
  likes: z.number().default(0),
  likedBy: z.array(z.string()).default([]),
  similarity: z.number().optional(),
  fetchedAt: z.date().default(() => new Date()),
  source: z.enum(["quotable", "dummyjson", "internal"]).default("quotable"),
});

export type Quote = z.infer<typeof QuoteSchema>;

export interface QuoteWithSimilarity extends Quote {
  similarity: number;
}

export interface QuoteFilters {
  author?: string;
  tags?: string[];
  minLength?: number;
  maxLength?: number;
  minLikes?: number;
}

export interface QuotePaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: "likes" | "length" | "fetchedAt";
  sortOrder?: "asc" | "desc";
}
