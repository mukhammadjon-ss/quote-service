import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { Type } from "@sinclair/typebox";
import rateLimit from "@fastify/rate-limit";
import { AuthService } from "../services/auth.service";
import { UserService } from "../services/user.service";
import {
  CreateUserSchema,
  LoginSchema,
  RefreshTokenSchema,
  UpdateProfileSchema,
} from "../models/user.model";
import { logger } from "../utils/logger";

const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const authService = new AuthService(fastify.mongo.db);
  const userService = new UserService(fastify.mongo.db);
    // Rate limiting
    fastify.register(rateLimit, {
        max: 100,
        timeWindow: "1 minute",
        keyGenerator: (req) => req.ip,
        skipOnError: true,
    });

  fastify.decorate("authService", authService);
  fastify.decorate("userService", userService);
  // Register
  fastify.post(
    "/auth/register",
    {
      schema: {
        summary: "Register a new user",
        tags: ["Authentication"],
        body: Type.Object({
          email: Type.String({ format: "email" }),
          username: Type.String({ minLength: 3, maxLength: 30 }),
          password: Type.String({ minLength: 8 }),
          firstName: Type.String({ minLength: 1, maxLength: 50 }),
          lastName: Type.String({ minLength: 1, maxLength: 50 }),
        }),
        response: {
          201: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              user: Type.Object({
                id: Type.String(),
                email: Type.String(),
                username: Type.String(),
                firstName: Type.String(),
                lastName: Type.String(),
                role: Type.String(),
                isActive: Type.Boolean(),
                isEmailVerified: Type.Boolean(),
              }),
              accessToken: Type.String(),
              refreshToken: Type.String(),
              expiresIn: Type.Number(),
            }),
          }),
          400: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            code: Type.Optional(Type.String()),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const userData = CreateUserSchema.parse(request.body);
        const authResponse = await authService.register(userData);

        logger.info("User registration successful", {
          operation: "register",
          userId: authResponse.user.id,
        //   email: authResponse.user.email,
          requestId: request.id,
        });

        return reply.code(201).send({
          success: true,
          data: authResponse,
        });
      } catch (error) {
        logger.error("Registration failed", error as Error, {
          operation: "register",
          requestId: request.id,
          ip: request.ip,
        });

        return reply.code(400).send({
          success: false,
          error: (error as Error).message,
          code: "REGISTRATION_FAILED",
        });
      }
    }
  );

  // Login
  fastify.post(
    "/auth/login",
    {
      schema: {
        summary: "Login user",
        tags: ["Authentication"],
        body: Type.Object({
          email: Type.String({ format: "email" }),
          password: Type.String({ minLength: 1 }),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              user: Type.Object({
                id: Type.String(),
                email: Type.String(),
                username: Type.String(),
                firstName: Type.String(),
                lastName: Type.String(),
                role: Type.String(),
              }),
              accessToken: Type.String(),
              refreshToken: Type.String(),
              expiresIn: Type.Number(),
            }),
          }),
          401: Type.Object({
            success: Type.Boolean(),
            error: Type.String(),
            code: Type.String(),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const credentials = LoginSchema.parse(request.body);
        const authResponse = await authService.login(
          credentials,
          request.ip,
          request.headers["user-agent"]
        );

        return reply.code(200).send({
          success: true,
          data: authResponse,
        });
      } catch (error) {
        return reply.code(401).send({
          success: false,
          error: (error as Error).message,
          code: "LOGIN_FAILED",
        });
      }
    }
  );

  // Refresh token
  fastify.post(
    "/auth/refresh",
    {
      schema: {
        summary: "Refresh access token",
        tags: ["Authentication"],
        body: Type.Object({
          refreshToken: Type.String(),
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean(),
            data: Type.Object({
              accessToken: Type.String(),
              expiresIn: Type.Number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      try {
        const { refreshToken } = RefreshTokenSchema.parse(request.body);
        const result = await authService.refreshToken(refreshToken);

        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (error) {
        return reply.code(401).send({
          success: false,
          error: "Invalid refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
      }
    }
  );

  // Logout
  fastify.post(
    "/auth/logout",
    {
      preHandler: [fastify.authenticate],
      schema: {
        summary: "Logout user",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
      },
    },
    async (request, reply) => {
      try {
        await authService.logout(request.user!.userId);

        return reply.code(200).send({
          success: true,
          message: "Logged out successfully",
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: "Logout failed",
        });
      }
    }
  );

  fastify.get(
    "/auth/profile",
    {
      preHandler: [fastify.authenticate],
      schema: {
        summary: "Get current user profile",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
      },
    },
    async (request, reply) => {
      try {
        const user = await userService.getUserById(request.user!.userId);

        if (!user) {
          return reply.code(404).send({
            success: false,
            error: "User not found",
          });
        }

        const stats = await userService.getUserStats(user.id);

        // Remove sensitive data
        const {
          password,
          emailVerificationToken,
          passwordResetToken,
          ...userProfile
        } = user;

        return reply.code(200).send({
          success: true,
          data: {
            ...userProfile,
            stats,
          },
        });
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: "Failed to fetch profile",
        });
      }
    }
  );

  // Update user profile
  fastify.put(
    "/auth/profile",
    {
      preHandler: [fastify.authenticate],
      schema: {
        summary: "Update user profile",
        tags: ["Authentication"],
        security: [{ Bearer: [] }],
        body: Type.Object({
          firstName: Type.Optional(
            Type.String({ minLength: 1, maxLength: 50 })
          ),
          lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 50 })),
          preferences: Type.Optional(
            Type.Object({
              theme: Type.Optional(
                Type.Union([Type.Literal("light"), Type.Literal("dark")])
              ),
              emailNotifications: Type.Optional(Type.Boolean()),
              quotesPerPage: Type.Optional(
                Type.Number({ minimum: 5, maximum: 50 })
              ),
            })
          ),
        }),
      },
    },
    async (request, reply) => {
      try {
        const profileData = UpdateProfileSchema.parse(request.body);
        const updatedUser = await userService.updateProfile(
          request.user!.userId,
          profileData
        );

        if (!updatedUser) {
          return reply.code(404).send({
            success: false,
            error: "User not found",
          });
        }

        // Remove sensitive data
        const {
          password,
          emailVerificationToken,
          passwordResetToken,
          ...userProfile
        } = updatedUser;

        return reply.code(200).send({
          success: true,
          data: userProfile,
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: "Profile update failed",
        });
      }
    }
  );
};

export { authRoutes };
