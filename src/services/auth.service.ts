import { Db } from "mongodb";
import {
  User,
  CreateUser,
  LoginCredentials,
  AuthResponse,
  TokenPayload,
  RefreshTokenPayload,
} from "../models/user.model";
import { UserService } from "./user.service";
import { PasswordUtils } from "../utils/password";
import { JWTUtils } from "../utils/jwt";
import { logger } from "../utils/logger";

export class AuthService {
  private userService: UserService;
  private tokenVersions: Map<string, number> = new Map(); // In production, use Redis

  constructor(db: Db) {
    this.userService = new UserService(db);
  }

  async register(userData: CreateUser): Promise<AuthResponse> {
    try {
      // Create user
      const user = await this.userService.createUser(userData);

      // Generate tokens
      const tokenPayload: Omit<TokenPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const refreshTokenPayload: Omit<RefreshTokenPayload, "iat" | "exp"> = {
        userId: user.id,
        tokenVersion: this.getTokenVersion(user.id),
      };

      const accessToken = JWTUtils.generateAccessToken(tokenPayload);
      const refreshToken = JWTUtils.generateRefreshToken(refreshTokenPayload);

      logger.info("User registered successfully", {
        operation: "register",
        userId: user.id,
        // email: user.email,
      });

      // Remove sensitive data from response
      const {
        password,
        emailVerificationToken,
        passwordResetToken,
        ...userResponse
      } = user;

      return {
        user: userResponse,
        accessToken,
        refreshToken,
        expiresIn: JWTUtils.getAccessTokenExpiryTime(),
      };
    } catch (error) {
      logger.error("Registration failed", error as Error, {
        operation: "register",
        // email: userData.email,
      });
      throw error;
    }
  }

  async login(
    credentials: LoginCredentials,
    ip?: string,
    userAgent?: string
  ): Promise<AuthResponse> {
    try {
      // Get user by email
      const user = await this.userService.getUserByEmail(credentials.email);

      if (!user) {
        logger.securityEvent("login_attempt_invalid_email", {
          ip,
          userAgent,
          severity: "low",
          metadata: {
            email: credentials.email,
          },
        });
        throw new Error("Invalid email or password");
      }

      // Check if account is locked
      const isLocked = await this.userService.isAccountLocked(user);
      if (isLocked) {
        logger.securityEvent("login_attempt_locked_account", {
          userId: user.id,
          ip,
          userAgent,
          severity: "medium",
        });
        throw new Error(
          "Account is temporarily locked due to too many failed login attempts"
        );
      }

      // Check if account is active
      if (!user.isActive) {
        logger.securityEvent("login_attempt_inactive_account", {
          userId: user.id,
          ip,
          userAgent,
          severity: "medium",
        });
        throw new Error("Account is deactivated");
      }

      // Verify password
      const isPasswordValid = await PasswordUtils.comparePassword(
        credentials.password,
        user.password
      );

      if (!isPasswordValid) {
        // Increment login attempts
        await this.userService.incrementLoginAttempts(user.id);

        logger.securityEvent("login_attempt_invalid_password", {
          userId: user.id,
          ip,
          userAgent,
          severity: "medium",
          metadata: {
            attempts: user.loginAttempts + 1,
          },
        });

        throw new Error("Invalid email or password");
      }

      // Reset login attempts on successful login
      await this.userService.resetLoginAttempts(user.id);

      // Generate tokens
      const tokenPayload: Omit<TokenPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const refreshTokenPayload: Omit<RefreshTokenPayload, "iat" | "exp"> = {
        userId: user.id,
        tokenVersion: this.getTokenVersion(user.id),
      };

      const accessToken = JWTUtils.generateAccessToken(tokenPayload);
      const refreshToken = JWTUtils.generateRefreshToken(refreshTokenPayload);

      logger.info("User logged in successfully", {
        operation: "login",
        userId: user.id,
        ip,
        userAgent,
      });

      // Remove sensitive data from response
      const {
        password,
        emailVerificationToken,
        passwordResetToken,
        ...userResponse
      } = user;

      return {
        user: userResponse,
        accessToken,
        refreshToken,
        expiresIn: JWTUtils.getAccessTokenExpiryTime(),
      };
    } catch (error) {
      logger.error("Login failed", error as Error, {
        operation: "login",
        // email: credentials.email,
        ip,
        userAgent,
      });
      throw error;
    }
  }

  async refreshToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = JWTUtils.verifyRefreshToken(refreshToken);
      const currentVersion = this.getTokenVersion(payload.userId);
      if (payload.tokenVersion !== currentVersion) {
        throw new Error("Token version mismatch");
      }

      const user = await this.userService.getUserById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error("User not found or inactive");
      }
      
      const tokenPayload: Omit<TokenPayload, "iat" | "exp"> = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = JWTUtils.generateAccessToken(tokenPayload);

      logger.info("Token refreshed successfully", {
        operation: "refresh_token",
        userId: user.id,
      });

      return {
        accessToken,
        expiresIn: JWTUtils.getAccessTokenExpiryTime(),
      };
    } catch (error) {
      logger.error("Token refresh failed", error as Error, {
        operation: "refresh_token",
      });
      throw new Error("Invalid refresh token");
    }
  }

  async logout(userId: string): Promise<void> {
    // Invalidate all tokens for this user by incrementing token version
    this.incrementTokenVersion(userId);

    logger.info("User logged out successfully", {
      operation: "logout",
      userId,
    });
  }

  async validateAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = JWTUtils.verifyAccessToken(token);

      // Additional validation - check if user still exists and is active
      const user = await this.userService.getUserById(payload.userId);
      if (!user || !user.isActive) {
        return null;
      }

      return payload;
    } catch (error) {
      return null;
    }
  }

  private getTokenVersion(userId: string): number {
    return this.tokenVersions.get(userId) || 0;
  }

  private incrementTokenVersion(userId: string): void {
    const currentVersion = this.getTokenVersion(userId);
    this.tokenVersions.set(userId, currentVersion + 1);
  }
}
