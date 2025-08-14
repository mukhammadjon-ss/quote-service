import pino, { Logger } from "pino";
import { FastifyBaseLogger } from "fastify";

interface LoggerConfig {
  level: string;
  environment: string;
  service: string;
  version: string;
}

interface StructuredLogData {
  requestId?: string;
  userId?: string;
  quoteId?: string;
  operation?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  error?: Error | string;
  metadata?: Record<string, any>;
}

class QuoteServiceLogger {
  private logger: Logger;
  private config: LoggerConfig;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: process.env.LOG_LEVEL || "info",
      environment: process.env.NODE_ENV || "development",
      service: "quote-service",
      version: process.env.SERVICE_VERSION || "1.0.0",
      ...config,
    };

    this.logger = this.createLogger();
  }

  private createLogger(): Logger {
    const isDevelopment = this.config.environment === "development";
    const isProduction = this.config.environment === "production";

    const baseConfig = {
      level: this.config.level,
      base: {
        service: this.config.service,
        version: this.config.version,
        environment: this.config.environment,
        pid: process.pid,
        hostname: process.env.HOSTNAME || require("os").hostname(),
      },
    };

    if (isDevelopment) {
      // Pretty printing for development
      return pino({
        ...baseConfig,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "yyyy-mm-dd HH:MM:ss",
            ignore: "pid,hostname,service,version,environment",
            messageFormat: "[{service}] {msg}",
            errorLikeObjectKeys: ["err", "error"],
            singleLine: false,
          },
        },
      });
    }

    if (isProduction) {
      // Structured JSON logging for production
      return pino({
        ...baseConfig,
        formatters: {
          level: (label) => ({ level: label }),
          log: (object) => {
            const { req, res, ...rest } = object;
            return rest;
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "password",
            "token",
            "secret",
            "key",
          ],
          censor: "[REDACTED]",
        },
      });
    }

    // Default configuration for other environments
    return pino(baseConfig);
  }

  // Basic logging methods
  debug(message: string, data?: StructuredLogData): void {
    this.logger.debug(this.formatLogData(data), message);
  }

  info(message: string, data?: StructuredLogData): void {
    this.logger.info(this.formatLogData(data), message);
  }

  warn(message: string, data?: StructuredLogData): void {
    this.logger.warn(this.formatLogData(data), message);
  }

  error(
    message: string,
    error?: Error | string,
    data?: StructuredLogData
  ): void {
    const logData = this.formatLogData(data);

    if (error instanceof Error) {
      logData.err = {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        statusCode: (error as any).statusCode,
      };
    } else if (typeof error === "string") {
      logData.error = error;
    }

    this.logger.error(logData, message);
  }

  fatal(
    message: string,
    error?: Error | string,
    data?: StructuredLogData
  ): void {
    const logData = this.formatLogData(data);

    if (error instanceof Error) {
      logData.err = {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (typeof error === "string") {
      logData.error = error;
    }

    this.logger.fatal(logData, message);
  }

  // Specialized logging methods
  httpRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    requestId?: string;
    userId?: string;
    userAgent?: string;
    ip?: string;
    contentLength?: number;
  }): void {
    this.info("HTTP request completed", {
      operation: "http_request",
      method: data.method,
      url: data.url,
      statusCode: data.statusCode,
      duration: data.duration,
      requestId: data.requestId,
      userId: data.userId,
      userAgent: data.userAgent,
      ip: data.ip,
      metadata: {
        contentLength: data.contentLength,
      },
    });
  }

  databaseOperation(
    operation: string,
    duration: number,
    data?: {
      collection?: string;
      query?: Record<string, any>;
      result?: any;
      error?: Error;
    }
  ): void {
    const logLevel = data?.error ? "error" : "debug";
    const message = `Database operation: ${operation}`;

    const logData: StructuredLogData = {
      operation: "database_operation",
      duration,
      metadata: {
        operation,
        collection: data?.collection,
        query: data?.query ? JSON.stringify(data.query) : undefined,
        resultCount: Array.isArray(data?.result)
          ? data.result.length
          : undefined,
      },
    };

    if (data?.error) {
      this.error(message, data.error, logData);
    } else {
      this.debug(message, logData);
    }
  }

  externalApiCall(
    service: string,
    duration: number,
    data?: {
      url?: string;
      method?: string;
      statusCode?: number;
      error?: Error;
      requestId?: string;
    }
  ): void {
    const logLevel = data?.error ? "error" : "info";
    const message = `External API call to ${service}`;

    const logData: StructuredLogData = {
      operation: "external_api_call",
      duration,
      requestId: data?.requestId,
      metadata: {
        service,
        url: data?.url,
        method: data?.method,
        statusCode: data?.statusCode,
      },
    };

    if (data?.error) {
      this.error(message, data.error, logData);
    } else {
      this.info(message, logData);
    }
  }

  businessOperation(
    operation: string,
    data?: {
      userId?: string;
      quoteId?: string;
      result?: any;
      duration?: number;
      metadata?: Record<string, any>;
    }
  ): void {
    this.info(`Business operation: ${operation}`, {
      operation: "business_operation",
      userId: data?.userId,
      quoteId: data?.quoteId,
      duration: data?.duration,
      metadata: {
        operation,
        result: data?.result,
        ...data?.metadata,
      },
    });
  }

  securityEvent(
    event: string,
    data?: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      severity?: "low" | "medium" | "high" | "critical";
      metadata?: Record<string, any>;
    }
  ): void {
    const severity = data?.severity || "medium";
    const logLevel =
      severity === "critical"
        ? "fatal"
        : severity === "high"
        ? "error"
        : severity === "medium"
        ? "warn"
        : "info";

    const message = `Security event: ${event}`;
    const logData: StructuredLogData = {
      operation: "security_event",
      userId: data?.userId,
      ip: data?.ip,
      userAgent: data?.userAgent,
      metadata: {
        event,
        severity,
        ...data?.metadata,
      },
    };

    switch (logLevel) {
      case "fatal":
        this.fatal(message, undefined, logData);
        break;
      case "error":
        this.error(message, undefined, logData);
        break;
      case "warn":
        this.warn(message, logData);
        break;
      default:
        this.info(message, logData);
    }
  }

  performance(
    operation: string,
    duration: number,
    data?: {
      threshold?: number;
      metadata?: Record<string, any>;
    }
  ): void {
    const threshold = data?.threshold || 1000; // Default 1 second threshold
    const isSlowOperation = duration > threshold;

    const message = `Performance: ${operation} took ${duration}ms`;
    const logData: StructuredLogData = {
      operation: "performance_metric",
      duration,
      metadata: {
        operation,
        isSlowOperation,
        threshold,
        ...data?.metadata,
      },
    };

    if (isSlowOperation) {
      this.warn(message, logData);
    } else {
      this.debug(message, logData);
    }
  }

  // Helper methods
  private formatLogData(data?: StructuredLogData): Record<string, any> {
    if (!data) return {};

    return {
      requestId: data.requestId,
      userId: data.userId,
      quoteId: data.quoteId,
      operation: data.operation,
      duration: data.duration,
      statusCode: data.statusCode,
      method: data.method,
      url: data.url,
      userAgent: data.userAgent,
      ip: data.ip,
      ...data.metadata,
    };
  }

  // Create child logger with additional context
  child(context: Record<string, any>): QuoteServiceLogger {
    const childLogger = new QuoteServiceLogger(this.config);
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  // Get the underlying Pino logger for Fastify integration
  getPinoLogger(): Logger {
    return this.logger;
  }

  // Flush logs (useful for testing and graceful shutdown)
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.flush(() => resolve());
    });
  }
}

// Create singleton instance
export const logger = new QuoteServiceLogger();

// Export the class for creating custom instances
export { QuoteServiceLogger };

// Export types for use in other modules
export type { StructuredLogData, LoggerConfig };

// Helper function to create request-scoped logger
export function createRequestLogger(
  requestId: string,
  userId?: string
): QuoteServiceLogger {
  return logger.child({
    requestId,
    userId,
  });
}

// Helper function for timing operations
export function createTimer() {
  const start = Date.now();
  return {
    end: () => Date.now() - start,
    lap: () => Date.now() - start,
  };
}

// Middleware helper for logging HTTP requests
export function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  requestId?: string,
  userId?: string,
  additionalData?: Record<string, any>
) {
  logger.httpRequest({
    method,
    url,
    statusCode,
    duration,
    requestId,
    userId,
    ...additionalData,
  });
}
