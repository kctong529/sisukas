// src/services/FavouritesService.ts
import { db } from '../db';
import { favourites } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export class FavouritesService {
  static async getFavouritesByUser(userId: string) {
    try {
      const userFavourites = await db
        .select()
        .from(favourites)
        .where(eq(favourites.userId, userId));

      return userFavourites;
    } catch (error) {
      console.error('Error fetching favourites:', error);
      throw new Error('Failed to fetch favourites from database');
    }
  }

  static async addFavourite(data: {
    userId: string;
    courseId: string;
    notes?: string | null;
  }) {
    try {
      const [favourite] = await db
        .insert(favourites)
        .values({
          userId: data.userId,
          courseId: data.courseId,
          notes: data.notes || null,
          addedAt: new Date(),
        })
        .returning();

      if (!favourite) {
        throw new Error('Failed to create favourite');
      }

      return favourite;
    } catch (error) {
      console.error('Error adding favourite:', error);
      throw error;
    }
  }

  static async removeFavourite(userId: string, courseId: string) {
    try {
      const result = await db
        .delete(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.courseId, courseId)
          )
        )
        .returning({ id: favourites.id });

      return result.length > 0;
    } catch (error) {
      console.error('Error removing favourite:', error);
      throw error;
    }
  }

  static async updateFavouriteNotes(
    userId: string,
    courseId: string,
    notes: string | null
  ) {
    try {
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

      return updated || null;
    } catch (error) {
      console.error('Error updating favourite notes:', error);
      throw error;
    }
  }

  static async verifyOwnership(userId: string, courseId: string) {
    try {
      const [favourite] = await db
        .select({ id: favourites.id })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.courseId, courseId)
          )
        );

      return !!favourite;
    } catch (error) {
      console.error('Error verifying ownership:', error);
      throw error;
    }
  }

  static async getFavourite(userId: string, courseId: string) {
    try {
      const [favourite] = await db
        .select()
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.courseId, courseId)
          )
        );

      return favourite || null;
    } catch (error) {
      console.error('Error fetching favourite:', error);
      throw error;
    }
  }

  static async getFavouriteCount(userId: string) {
    try {
      const result = await db
        .select()
        .from(favourites)
        .where(eq(favourites.userId, userId));

      return result.length;
    } catch (error) {
      console.error('Error counting favourites:', error);
      throw error;
    }
  }

  static async isFavourited(userId: string, courseId: string) {
    try {
      const [favourite] = await db
        .select({ id: favourites.id })
        .from(favourites)
        .where(
          and(
            eq(favourites.userId, userId),
            eq(favourites.courseId, courseId)
          )
        );

      return !!favourite;
    } catch (error) {
      console.error('Error checking if course is favourited:', error);
      throw error;
    }
  }
}
