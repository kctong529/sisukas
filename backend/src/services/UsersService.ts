// src/services/UsersService.ts
import { auth } from '../lib/auth';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export class UsersService {
  static async getAllUsers() {
    return await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      emailVerified: users.emailVerified,
      image: users.image,
      createdAt: users.createdAt,
    }).from(users);
  }

  static async getUserById(id: string) {
    const [user] = await db
      .select()
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

  // Use Better Auth's built-in API to create a user
  static async createUser(data: { email: string; password: string; name: string }) {
    return await auth.api.signUpEmail({
      body: {
        email: data.email,
        password: data.password,
        name: data.name,
      },
    });
  }

  static async updateUser(id: string, name: string) {
    const [updated] = await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    return updated;
  }

  static async deleteUser(id: string) {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return deleted;
  }
}