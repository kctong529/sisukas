// src/infrastructure/services/FiltersApiService.ts
import type { SerializedFilters } from '../../domain/filters/helpers/FilterSerializer';

const FILTERS_API_URL = import.meta.env.VITE_FILTERS_API;

export interface SaveFilterResponse {
  hash_id: string;
}

/**
 * Service for interacting with the filters API
 */
export class FiltersApiService {
  /**
   * Save filters to API and get shareable hash
   */
  static async saveFilters(filters: SerializedFilters): Promise<string | null> {
    try {
      const response = await fetch(`${FILTERS_API_URL}/api/filters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save filters';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = response.statusText;
        }
        throw new Error(errorMessage);
      }

      const data: SaveFilterResponse = await response.json();
      
      if (!data.hash_id) {
        throw new Error('Invalid response structure');
      }

      return data.hash_id;
    } catch (error) {
      console.error('Error saving filters:', error);
      throw error;
    }
  }

  /**
   * Load filters from API by hash ID
   */
  static async loadFilters(hashId: string): Promise<SerializedFilters> {
    try {
      const response = await fetch(`${FILTERS_API_URL}/api/filters/${hashId}`);
      
      if (!response.ok) {
        let errorMessage = 'Failed to load filters';
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = response.statusText;
        }

        // Provide specific error messages
        switch (response.status) {
          case 404:
            throw new Error('These filters no longer exist or have been deleted');
          case 422:
            throw new Error('Invalid filter URL format');
          case 503:
            throw new Error('Filter service is temporarily unavailable');
          default:
            throw new Error(errorMessage);
        }
      }

      const data: SerializedFilters = await response.json();
      
      if (!data.groups || !Array.isArray(data.groups)) {
        throw new Error('Invalid filter data structure');
      }

      return data;
    } catch (error) {
      console.error('Error loading filters:', error);
      throw error;
    }
  }

  /**
   * Create shareable URL for saved filters
   */
  static createShareableUrl(hashId: string): string {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}?filter=${hashId}`;
  }

  /**
   * Get hash ID from current URL if present
   */
  static getHashFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('filter');
  }
}