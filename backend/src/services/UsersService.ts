// src/services/UsersService.ts
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface CreateUserDto {
  email: string;
  name?: string;
  emailVerified?: boolean;
}

export class UsersService {
  static async getAllUsers() {
    return await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      createdAt: users.createdAt,
    }).from(users);
  }

  static async getUserById(id: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        emailVerified: users.emailVerified,
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
        id: `user_${Date.now()}`,
        email: data.email,
        name: data.name || '',
        emailVerified: data.emailVerified || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
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