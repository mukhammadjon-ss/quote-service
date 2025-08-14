import jwt from "jsonwebtoken";
import { TokenPayload, RefreshTokenPayload } from "../models/user.model";

export class JWTUtils {
  private static readonly ACCESS_TOKEN_SECRET =
    process.env.JWT_ACCESS_SECRET || "your-super-secret-access-key";
  private static readonly REFRESH_TOKEN_SECRET =
    process.env.JWT_REFRESH_SECRET || "your-super-secret-refresh-key";
  private static readonly ACCESS_TOKEN_EXPIRY =
    process.env.JWT_ACCESS_EXPIRY || "15m";
  private static readonly REFRESH_TOKEN_EXPIRY =
    process.env.JWT_REFRESH_EXPIRY || "7d";

  static generateAccessToken(
    payload: Omit<TokenPayload, "iat" | "exp">
  ): string {
    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      issuer: "quote-service",
      audience: "quote-service-users",
    });
  }

  static generateRefreshToken(
    payload: Omit<RefreshTokenPayload, "iat">
  ): string {
    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
      issuer: "quote-service",
      audience: "quote-service-users",
    });
  }

  static verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: "quote-service",
        audience: "quote-service-users",
      }) as TokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired access token");
    }
  }

  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "quote-service",
        audience: "quote-service-users",
      }) as RefreshTokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired refresh token");
    }
  }

  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  static getAccessTokenExpiryTime(): number {
    const expiry = this.ACCESS_TOKEN_EXPIRY;
    if (expiry.endsWith("m")) {
      return parseInt(expiry) * 60;
    } else if (expiry.endsWith("h")) {
      return parseInt(expiry) * 60 * 60;
    } else if (expiry.endsWith("d")) {
      return parseInt(expiry) * 24 * 60 * 60;
    }
    return parseInt(expiry); // assume seconds
  }

  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }
}
