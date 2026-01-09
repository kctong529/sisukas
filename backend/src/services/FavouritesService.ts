// src/services/FavouritesService.ts
import { db } from '../db';
import { favourites } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export interface CreateFavouriteDto {
  userId: string;
  courseId: string;
  notes?: string;
}

export class FavouritesService {
  static async getFavouritesByUser(userId: string) {
    return await db
      .select()
      .from(favourites)
      .where(eq(favourites.userId, userId));
  }

  static async addFavourite(data: CreateFavouriteDto) {
    const [favourite] = await db
      .insert(favourites)
      .values({
        userId: data.userId,
        courseId: data.courseId,
        notes: data.notes
      })
      .returning();

    return favourite;
  }

  static async removeFavourite(userId: string, courseId: string) {
    const [deleted] = await db
      .delete(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.courseId, courseId)
        )
      )
      .returning();

    return deleted;
  }

  static async updateFavouriteNotes(
    userId: string,
    courseId: string,
    notes: string
  ) {
    const [updated] = await db
      .update(favourites)
      .set({ notes })
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.courseId, courseId)
        )
      )
      .returning();

    return updated;
  }

  static async isFavourite(userId: string, courseId: string) {
    const result = await db
      .select()
      .from(favourites)
      .where(
        and(
          eq(favourites.userId, userId),
          eq(favourites.courseId, courseId)
        )
      );

    return result.length > 0;
  }
}