import bcrypt from "bcrypt";
import crypto from "crypto";

export class PasswordUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Compare a plain text password with a hashed password
   */
  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate a secure random token
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Generate a password reset token with expiry
   */
  static generatePasswordResetToken(): { token: string; expires: Date } {
    const token = this.generateSecureToken();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour from now

    return { token, expires };
  }

  /**
   * Generate an email verification token
   */
  static generateEmailVerificationToken(): string {
    return this.generateSecureToken();
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push("Password should be at least 8 characters long");

    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push("Password should contain lowercase letters");

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push("Password should contain uppercase letters");

    if (/\d/.test(password)) score += 1;
    else feedback.push("Password should contain numbers");

    if (/[@$!%*?&]/.test(password)) score += 1;
    else feedback.push("Password should contain special characters");

    // Common patterns check
    if (!/(.)\1{2,}/.test(password)) score += 1;
    else feedback.push("Password should not contain repeated characters");

    return {
      isValid: score >= 5,
      score,
      feedback,
    };
  }
}
