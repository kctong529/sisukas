// src/infrastructure/services/FiltersApiService.ts
import type { SerializedFilters } from '../../domain/filters/helpers/FilterSerializer';
import { NotificationService } from './NotificationService';

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
   * Returns hash_id on success, null on failure (error is shown via notification)
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

        // Provide specific error messages based on status code
        switch (response.status) {
          case 422:
            NotificationService.error('Invalid filter data format');
            break;
          case 500:
            NotificationService.error('Server error while saving filters');
            break;
          case 503:
            NotificationService.error('Filter service is temporarily unavailable');
            break;
          default:
            NotificationService.error(errorMessage);
        }
        
        return null;
      }

      const data: SaveFilterResponse = await response.json();
      
      if (!data.hash_id) {
        NotificationService.error('Invalid response from server');
        return null;
      }

      return data.hash_id;
    } catch (error) {
      console.error('Error saving filters:', error);
      NotificationService.error('Unable to connect to filter service');
      return null;
    }
  }

  /**
   * Load filters from API by hash ID
   * Returns filter data on success, null on failure (error is shown via notification)
   */
  static async loadFilters(hashId: string): Promise<SerializedFilters | null> {
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
            NotificationService.error('These filters no longer exist or have been deleted');
            break;
          case 422:
            NotificationService.error('Invalid filter URL format');
            break;
          case 500:
            NotificationService.error('Server error while loading filters');
            break;
          case 503:
            NotificationService.error('Filter service is temporarily unavailable');
            break;
          default:
            NotificationService.error(errorMessage);
        }
        
        return null;
      }

      const data: SerializedFilters = await response.json();
      
      if (!data.groups || !Array.isArray(data.groups)) {
        NotificationService.error('Invalid filter data structure');
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error loading filters:', error);
      NotificationService.error('Unable to connect to filter service');
      return null;
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