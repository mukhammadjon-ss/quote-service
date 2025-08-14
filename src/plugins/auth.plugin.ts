import fp from "fastify-plugin";
import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { AuthService } from "../services/auth.service";
import { JWTUtils } from "../utils/jwt";
import { logger } from "../utils/logger";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requireRole: (
      roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user?: {
      userId: string;
      email: string;
      role: string;
    };
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Wait for services to be available
  await fastify.after();

  const authService = new AuthService(fastify.mongo.db);

  // Authentication decorator
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;
        const token = JWTUtils.extractTokenFromHeader(authHeader);

        if (!token) {
          logger.securityEvent("missing_auth_token", {
            ip: request.ip,
            userAgent: request.headers["user-agent"],
            severity: "low",
            metadata: {
              endpoint: request.url,
              method: request.method,
            },
          });

          return reply.code(401).send({
            success: false,
            error: "Authentication required",
            code: "AUTH_REQUIRED",
          });
        }

        const payload = await authService.validateAccessToken(token);

        if (!payload) {
          logger.securityEvent("invalid_auth_token", {
            ip: request.ip,
            userAgent: request.headers["user-agent"],
            severity: "medium",
            metadata: {
              endpoint: request.url,
              method: request.method,
            },
          });

          return reply.code(401).send({
            success: false,
            error: "Invalid or expired token",
            code: "INVALID_TOKEN",
          });
        }

        // Attach user to request
        request.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        };
      } catch (error) {
        logger.error("Authentication error", error as Error, {
          requestId: request.id,
          ip: request.ip,
        });

        return reply.code(401).send({
          success: false,
          error: "Authentication failed",
          code: "AUTH_FAILED",
        });
      }
    }
  );

  // Role-based authorization decorator
  fastify.decorate("requireRole", (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.code(401).send({
          success: false,
          error: "Authentication required",
          code: "AUTH_REQUIRED",
        });
      }

      if (!allowedRoles.includes(request.user.role)) {
        logger.securityEvent("insufficient_permissions", {
          userId: request.user.userId,
          ip: request.ip,
          userAgent: request.headers["user-agent"],
          severity: "medium",
          metadata: {
            userRole: request.user.role,
            requiredRoles: allowedRoles,
            endpoint: request.url,
            method: request.method,
          },
        });

        return reply.code(403).send({
          success: false,
          error: "Insufficient permissions",
          code: "INSUFFICIENT_PERMISSIONS",
        });
      }
    };
  });

  // Register auth service in fastify instance
  fastify.decorate("authService", authService);

  fastify.log.info("Auth plugin registered successfully");
};

export default fp(authPlugin, {
  name: "auth",
  dependencies: ["database"],
  fastify: "4.x",
});

export { authPlugin };
