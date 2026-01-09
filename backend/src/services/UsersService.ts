// src/services/UsersService.ts
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  displayName?: string;
}

export class UsersService {
  static async getAllUsers() {
    return await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      createdAt: users.createdAt,
      // Don't return passwordHash
    }).from(users);
  }

  static async getUserById(id: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id));

    return user;
  }

  static async getUserByEmail(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return user;
  }

  static async createUser(data: CreateUserDto) {
    const existing = await this.getUserByEmail(data.email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
      })
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        createdAt: users.createdAt,
      });

    return user;
  }

  static async deleteUser(id: string) {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
      });

    return deleted;
  }
}