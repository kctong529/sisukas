// src/lib/stores/favouritesStore.ts
import { writable } from 'svelte/store';
import { FavouritesService } from '../../infrastructure/services/FavouritesService';
import type { Favourite } from '../../infrastructure/services/FavouritesService';

export interface FavouritesStore {
  favourites: Favourite[];
  loading: boolean;
  error: string | null;
}

function createFavouritesStore() {
  const initialState: FavouritesStore = {
    favourites: [],
    loading: false,
    error: null,
  };

  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,

    /**
     * Load favourites from API
     */
    async load() {
      update(state => ({ ...state, loading: true, error: null }));
      
      try {
        const favourites = await FavouritesService.getFavourites();
        update(state => ({
          ...state,
          favourites,
          loading: false,
        }));
        return favourites;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to load favourites';
        update(state => ({
          ...state,
          loading: false,
          error,
        }));
        throw err;
      }
    },

    /**
     * Add a favourite (optimistic update)
     */
    async add(courseId: string) {
      try {
        // Optimistic update - show it immediately
        update(state => {
          const newFavourite: Favourite = {
            id: `temp-${Date.now()}`, // Temporary ID
            userId: '',
            courseId,
            notes: null,
            addedAt: new Date().toISOString(),
          };
          return {
            ...state,
            favourites: [...state.favourites, newFavourite],
          };
        });

        // Fetch from API to get real data
        const favourite = await FavouritesService.addFavourite(courseId);
        
        // Replace temporary with real
        update(state => ({
          ...state,
          favourites: state.favourites.map(f =>
            f.id.startsWith('temp-') && f.courseId === courseId ? favourite : f
          ),
        }));
        
        return favourite;
      } catch (err) {
        // Rollback on error
        update(state => ({
          ...state,
          favourites: state.favourites.filter(f => f.courseId !== courseId),
        }));
        throw err;
      }
    },

    /**
     * Remove a favourite (optimistic update)
     */
    async remove(courseId: string) {
      try {
        // Optimistic update - remove immediately
        update(state => ({
          ...state,
          favourites: state.favourites.filter(f => f.courseId !== courseId),
        }));

        // Call API
        await FavouritesService.removeFavourite(courseId);
      } catch (err) {
        // Rollback on error - reload to get accurate state
        await this.load();
        throw err;
      }
    },

    /**
     * Update notes for a favourite
     */
    async updateNotes(courseId: string, notes: string | null) {
      try {
        const updated = await FavouritesService.updateFavouriteNotes(courseId, notes);
        
        update(state => ({
          ...state,
          favourites: state.favourites.map(f =>
            f.courseId === courseId ? updated : f
          ),
        }));
        
        return updated;
      } catch (err) {
        throw err;
      }
    },

    /**
     * Check if a course is in favourites
     */
    isFavourited(courseId: string): boolean {
      let result = false;
      this.subscribe(state => {
        result = state.favourites.some(f => f.courseId === courseId);
      })();
      return result;
    },

    /**
     * Clear all data (on sign out)
     */
    clear() {
      set(initialState);
    },
  };
}

export const favouritesStore = createFavouritesStore();