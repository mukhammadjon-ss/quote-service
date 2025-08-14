import { MyContext } from "../types/graphql.types";
import { JWTUtils } from "./jwt";
import { logger } from "./logger";

export class GraphQLAuthUtils {
  /**
   * Extract and validate JWT token from context
   */
  static async getUserFromContext(context: any): Promise<any> {
    try {
      const authHeader = context.reply.request.headers.authorization;
      const token = JWTUtils.extractTokenFromHeader(authHeader);

      if (!token) {
        return null;
      }

      const payload = await context.authService.validateAccessToken(token);
      return payload
        ? {
            userId: payload.userId,
            email: payload.email,
            role: payload.role,
            username: payload.username,
          }
        : null;
    } catch (error) {
      logger.error("Failed to extract user from context", error as Error);
      return null;
    }
  }

  /**
   * Require authentication - throw error if not authenticated
   */
  static requireAuth(context: any): any {
    if (!context.user) {
      throw new Error("Authentication required. Please log in.");
    }
    return context.user;
  }

}
