// src/infrastructure/services/FavouritesService.ts
import { NotificationService } from './NotificationService';

export interface Favourite {
  id: string;
  userId: string;
  courseId: string;
  notes: string | null;
  addedAt: string;
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export class FavouritesService {
  /**
   * Get all favourites for the current user
   * Requires authentication
   */
  static async getFavourites(): Promise<Favourite[]> {
    try {
      const response = await fetch(`${API_BASE}/api/favourites`, {
        method: 'GET',
        credentials: 'include', // Include cookies for session
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch favourites: ${response.statusText}`);
      }

      const data = await response.json();
      return data.favourites || [];
    } catch (error) {
      console.error('Error fetching favourites:', error);
      throw error;
    }
  }

  /**
   * Add a course to favourites
   * Requires authentication
   */
  static async addFavourite(
    courseId: string,
    notes?: string
  ): Promise<Favourite> {
    try {
      const response = await fetch(`${API_BASE}/api/favourites`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          notes: notes || null,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 400) {
          const error = await response.json();
          throw new Error(error.error || 'Invalid course ID');
        }
        throw new Error(`Failed to add favourite: ${response.statusText}`);
      }

      const data = await response.json();
      NotificationService.success(`Added "${data.favourite.courseId}" to favourites`);
      return data.favourite;
    } catch (error) {
      console.error('Error adding favourite:', error);
      const message = error instanceof Error ? error.message : 'Failed to add favourite';
      NotificationService.error(message);
      throw error;
    }
  }

  /**
   * Remove a course from favourites
   * Requires authentication
   */
  static async removeFavourite(courseId: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/api/favourites/${courseId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Favourite not found');
        }
        throw new Error(`Failed to remove favourite: ${response.statusText}`);
      }

      NotificationService.success(`Removed "${courseId}" from favourites`);
    } catch (error) {
      console.error('Error removing favourite:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove favourite';
      NotificationService.error(message);
      throw error;
    }
  }

  /**
   * Update notes for a favourite
   * Requires authentication
   */
  static async updateFavouriteNotes(
    courseId: string,
    notes: string | null
  ): Promise<Favourite> {
    try {
      const response = await fetch(`${API_BASE}/api/favourites/${courseId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        if (response.status === 404) {
          throw new Error('Favourite not found');
        }
        throw new Error(`Failed to update favourite: ${response.statusText}`);
      }

      const data = await response.json();
      NotificationService.success('Favourite updated');
      return data.favourite;
    } catch (error) {
      console.error('Error updating favourite:', error);
      const message = error instanceof Error ? error.message : 'Failed to update favourite';
      NotificationService.error(message);
      throw error;
    }
  }

  /**
   * Check if a course is in favourites
   * (Requires having all favourites loaded)
   */
  static isFavourited(courseId: string, favourites: Favourite[]): boolean {
    return favourites.some(fav => fav.courseId === courseId);
  }

  /**
   * Get notes for a specific favourite
   */
  static getFavouriteNotes(courseId: string, favourites: Favourite[]): string | null {
    const fav = favourites.find(f => f.courseId === courseId);
    return fav?.notes || null;
  }
}