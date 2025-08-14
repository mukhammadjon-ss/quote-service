import { Db, Collection } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import {
  User,
  CreateUser,
  UpdateProfileRequest,
  UserSchema,
} from "../models/user.model";
import { PasswordUtils } from "../utils/password";
import { logger } from "../utils/logger";

export class UserService {
  private db: Db;
  private collection: Collection<User>;

  constructor(db: Db) {
    this.db = db;
    this.collection = db.collection<User>("users");
    this.ensureIndexes();
  }

  private async ensureIndexes() {
    await this.collection.createIndex({ email: 1 }, { unique: true });
    await this.collection.createIndex({ username: 1 }, { unique: true });
    await this.collection.createIndex({ id: 1 }, { unique: true });
    await this.collection.createIndex({ emailVerificationToken: 1 });
    await this.collection.createIndex({ passwordResetToken: 1 });
    await this.collection.createIndex({ createdAt: 1 });
  }

  async createUser(userData: CreateUser): Promise<User> {
    try {
      // Check if user already exists
      const existingUser = await this.collection.findOne({
        $or: [{ email: userData.email }, { username: userData.username }],
      });

      if (existingUser) {
        if (existingUser.email === userData.email) {
          throw new Error("User with this email already exists");
        }
        if (existingUser.username === userData.username) {
          throw new Error("User with this username already exists");
        }
      }

      // Hash password
      const hashedPassword = await PasswordUtils.hashPassword(
        userData.password
      );

      // Create user object
      const user: User = {
        id: uuidv4(),
        email: userData.email,
        username: userData.username,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: "user",
        isActive: true,
        isEmailVerified: false,
        emailVerificationToken: PasswordUtils.generateEmailVerificationToken(),
        loginAttempts: 0,
        preferences: {
          theme: "light",
          emailNotifications: true,
          quotesPerPage: 10,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Validate user data
      const validatedUser = UserSchema.parse(user);

      // Insert user
      await this.collection.insertOne(validatedUser);

      logger.info("User created successfully", {
        operation: "create_user",
        userId: user.id,
      });

      return validatedUser;
    } catch (error) {
      logger.error("Failed to create user", error as Error, {
        operation: "create_user",
      });
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    return this.collection.findOne({ id });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.collection.findOne({ email });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return this.collection.findOne({ username });
  }

  async updateUser(
    id: string,
    updateData: Partial<User>
  ): Promise<User | null> {
    const updateDoc = {
      ...updateData,
      updatedAt: new Date(),
    };

    const result = await this.collection.findOneAndUpdate(
      { id },
      { $set: updateDoc },
      { returnDocument: "after" }
    );

    if (result) {
      logger.info("User updated successfully", {
        operation: "update_user",
        userId: id,
      });
    }

    return result;
  }

  async updateProfile(
    id: string,
    profileData: UpdateProfileRequest
  ): Promise<User | null> {
    const updateDoc: Partial<User> = {
      updatedAt: new Date(),
    };

    if (profileData.firstName) updateDoc.firstName = profileData.firstName;
    if (profileData.lastName) updateDoc.lastName = profileData.lastName;
    if (profileData.preferences) {
      // Merge preferences
      const user = await this.getUserById(id);
      if (user) {
        updateDoc.preferences = {
          ...user.preferences,
          ...profileData.preferences,
        };
      }
    }

    return this.updateUser(id, updateDoc);
  }

  async incrementLoginAttempts(id: string): Promise<void> {
    const maxAttempts = 5;
    const lockTime = 30 * 60 * 1000; // 30 minutes

    const user = await this.getUserById(id);
    if (!user) return;

    const attempts = user.loginAttempts + 1;
    const updateDoc: Partial<User> = {
      loginAttempts: attempts,
      updatedAt: new Date(),
    };

    // Lock account if max attempts reached
    if (attempts >= maxAttempts) {
      updateDoc.lockUntil = new Date(Date.now() + lockTime);

      logger.securityEvent("account_locked", {
        userId: id,
        severity: "high",
        metadata: {
          attempts,
          lockUntil: updateDoc.lockUntil,
        },
      });
    }

    await this.updateUser(id, updateDoc);
  }

  async resetLoginAttempts(id: string): Promise<void> {
    await this.updateUser(id, {
      loginAttempts: 0,
      lockUntil: undefined,
      lastLoginAt: new Date(),
    });
  }

  async isAccountLocked(user: User): Promise<boolean> {
    if (!user.lockUntil) return false;

    if (user.lockUntil > new Date()) {
      return true;
    }

    // Unlock account if lock time has passed
    await this.updateUser(user.id, {
      lockUntil: undefined,
      loginAttempts: 0,
    });

    return false;
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const user = await this.getUserById(id);
    if (!user) return false;

    const isCurrentPasswordValid = await PasswordUtils.comparePassword(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return false;
    }

    const hashedPassword = await PasswordUtils.hashPassword(newPassword);

    await this.updateUser(id, {
      password: hashedPassword,
    });

    logger.info("Password changed successfully", {
      operation: "change_password",
      userId: id,
    });

    return true;
  }

  async getUserStats(id: string): Promise<{
    totalQuotesLiked: number;
    accountAge: number;
    lastLogin: Date | null;
  }> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error("User not found");
    }

    // Get quote statistics from quotes collection
    const quotesCollection = this.db.collection("quotes");
    const totalQuotesLiked = await quotesCollection.countDocuments({
      likedBy: id,
    });

    const accountAge = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      totalQuotesLiked,
      accountAge,
      lastLogin: user.lastLoginAt || null,
    };
  }
}
