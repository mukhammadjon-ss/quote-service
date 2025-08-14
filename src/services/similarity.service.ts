import { Quote } from "../models/quote.model";

export class SimilarityService {
  calculateSimilarity(quote1: Quote, quote2: Quote): number {
    const contentSimilarity = this.calculateTextSimilarity(
      quote1.content.toLowerCase(),
      quote2.content.toLowerCase()
    );

    const authorSimilarity = quote1.author === quote2.author ? 1 : 0;

    const tagsSimilarity = this.calculateTagsSimilarity(
      quote1.tags,
      quote2.tags
    );

    const lengthSimilarity = this.calculateLengthSimilarity(
      quote1.length,
      quote2.length
    );

    // Weighted average
    return (
      contentSimilarity * 0.5 +
      authorSimilarity * 0.2 +
      tagsSimilarity * 0.2 +
      lengthSimilarity * 0.1
    );
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  private calculateTagsSimilarity(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 && tags2.length === 0) return 1;
    if (tags1.length === 0 || tags2.length === 0) return 0;

    const set1 = new Set(tags1);
    const set2 = new Set(tags2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  private calculateLengthSimilarity(length1: number, length2: number): number {
    const diff = Math.abs(length1 - length2);
    const maxLength = Math.max(length1, length2);

    return 1 - diff / maxLength;
  }
}
