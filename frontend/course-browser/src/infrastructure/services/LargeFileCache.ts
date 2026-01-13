<<<<<<< HEAD
// src/infrastructure/services/LargeFileCache.ts
// 
=======
>>>>>>> main
/**
 * LargeFileCache: Implements an IndexedDB-based cache for large files 
 * with a hash-driven Stale-While-Revalidate (SWR) fetching strategy.
 * This class isolates the complexities of I/O (IndexedDB and fetch) 
 * from the core application logic.
 */
<<<<<<< HEAD
export class LargeFileCache<T = unknown> {
=======
export class LargeFileCache {
>>>>>>> main
  db: IDBDatabase | null = null;

  constructor(
    private dbName = 'lastModified-cache',
    private version = 1
  ) { }

  // Initialize IndexedDB
  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      // Check for browser support
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB not supported by this browser.'));
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for cached files
        if (!db.objectStoreNames.contains('files')) {
          const store = db.createObjectStore('files', { keyPath: 'url' });
          // Index for cleaning old entries
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  // Get cached data
<<<<<<< HEAD
  async getCache(url: string): Promise<{ url: string, hash: string, data: T, timestamp: number, size: number } | undefined> {
=======
  async getCache(url: string): Promise<{ url: string, hash: string, data: any, timestamp: number, size: number } | undefined> {
>>>>>>> main
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(url);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Save data to cache
<<<<<<< HEAD
  async setCache(url: string, hash: string, data: T): Promise<void> {
=======
  async setCache(url: string, hash: string, data: any): Promise<void> {
>>>>>>> main
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      const cacheItem = {
        url,
        hash,
        data,
        timestamp: Date.now(),
        size: JSON.stringify(data).length
      };

      const request = store.put(cacheItem);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * SWR (Stale-While-Revalidate) fetch: Tries to serve cached data instantly.
   * If successful, it checks for updates in the background. If cache is empty, 
   * it fetches immediately.
   * @param dataUrl The URL to the course data file.
   * @param hashUrl The URL to the hash file for cache validation.
   * @returns The data from the cache or a fresh network request.
   */
<<<<<<< HEAD
  async fetch(dataUrl: string, hashUrl: string): Promise<T> {
=======
  async fetch(dataUrl: string, hashUrl: string): Promise<any> {
>>>>>>> main
    await this.init();
    const cached = await this.getCache(dataUrl);

    if (cached?.data) {
      // Serve cached data immediately (Stale)
      console.log(`Serving cached data for ${dataUrl} (${Math.round(cached.size / 1024 / 1024)}MB)`);

      // Background update (Revalidate)
      this.updateCacheIfNeeded(dataUrl, hashUrl, cached.hash).catch(err => {
        console.warn("Background cache update failed:", err);
      });

      return cached.data;
    }

    // No cached data, fetch immediately (blocking)
    return this.updateCacheIfNeeded(dataUrl, hashUrl, null);
  }

<<<<<<< HEAD
  async updateCacheIfNeeded(dataUrl: string, hashUrl: string, oldHash: string | null): Promise<T> {
=======
  async updateCacheIfNeeded(dataUrl: string, hashUrl: string, oldHash: string | null): Promise<any> {
>>>>>>> main
    try {
      // 1. Fetch the hash file to check for updates
      const hashRes = await fetch(hashUrl);
      if (!hashRes.ok) throw new Error(`Failed to fetch hash: ${hashRes.status}`);
      const { hash: newHash } = await hashRes.json();

      // 2. Check if cache is still valid
      if (oldHash === newHash) {
        console.log(`Cache up-to-date for ${dataUrl}`);
        const cached = await this.getCache(dataUrl);
<<<<<<< HEAD
        // Return cached data or throw if missing
        if (cached?.data) {
          return cached.data;
        }
        throw new Error(`Cache missing for ${dataUrl}`);
=======
        // Return cached data for background update check, or null if cache was empty
        return cached?.data ?? null;
>>>>>>> main
      }

      // 3. Cache is outdated or empty, fetch new data
      console.log(`Fetching updated data ${dataUrl}`);
      const dataRes = await fetch(dataUrl);
      if (!dataRes.ok) throw new Error(`Failed to fetch data: ${dataRes.status}`);
<<<<<<< HEAD
      const data = await dataRes.json() as T;
=======
      const data = await dataRes.json();
>>>>>>> main

      const sizeMB = Math.round(JSON.stringify(data).length / 1024 / 1024);
      console.log(`Downloaded ${sizeMB}MB, hash: ${newHash}`);

      // 4. Save new data to cache
      await this.setCache(dataUrl, newHash, data);
      return data;
    } catch (error) {
      const err = error as Error;
      console.error(`Failed to fetch ${dataUrl}: ${err.message}`);

      // If the network request fails but we have stale data, use it as a fallback
      if (oldHash !== null) {
        console.log(`Using stale cached data for ${dataUrl}`);
        const cached = await this.getCache(dataUrl);
        if (cached?.data) return cached.data;
      }

      // Critical failure: no cache and no network
      throw error;
    }
  }
}