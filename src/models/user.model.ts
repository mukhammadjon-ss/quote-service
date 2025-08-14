import { z } from "zod";

export const UserSchema = z.object({
  _id: z.string().optional(),
  id: z.string(),
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8), // Will store hashed password
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(["user", "admin", "moderator"]).default("user"),
  isActive: z.boolean().default(true),
  isEmailVerified: z.boolean().default(false),
  emailVerificationToken: z.string().optional(),
  passwordResetToken: z.string().optional(),
  passwordResetExpires: z.date().optional(),
  lastLoginAt: z.date().optional(),
  loginAttempts: z.number().default(0),
  lockUntil: z.date().optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark"]).default("light"),
      emailNotifications: z.boolean().default(true),
      quotesPerPage: z.number().min(5).max(50).default(10),
    })
    .default({}),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  preferences: z
    .object({
      theme: z.enum(["light", "dark"]).optional(),
      emailNotifications: z.boolean().optional(),
      quotesPerPage: z.number().min(5).max(50).optional(),
    })
    .optional(),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type LoginCredentials = z.infer<typeof LoginSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof ChangePasswordSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileSchema>;

// Response types
export interface AuthResponse {
  user: Omit<
    User,
    "password" | "emailVerificationToken" | "passwordResetToken"
  >;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}
