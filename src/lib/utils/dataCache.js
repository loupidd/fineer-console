class DataCache {
  constructor() {
    this.cache = new Map();
    this.loadingFlags = new Map();
  }

  /**
   * Get cached data or fetch new data if cache is stale
   * @param {string} key - Unique key for this data (e.g., 'employees', 'attendance')
   * @param {Function} fetchFunction - Async function that fetches the data
   * @param {number} cacheDuration - Cache duration in milliseconds (default: 2 minutes)
   */
  async getData(key, fetchFunction, cacheDuration = 120000) {
    const cached = this.cache.get(key);
    const now = Date.now();

    // Return cached data if still valid
    if (cached && (now - cached.timestamp) < cacheDuration) {
      console.log(`Using cached data for: ${key}`);
      return cached.data;
    }

    // Prevent duplicate fetches
    if (this.loadingFlags.get(key)) {
      console.log(`Already loading: ${key}, waiting...`);
      // Wait for existing fetch to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingFlags.get(key)) {
            clearInterval(checkInterval);
            const cached = this.cache.get(key);
            resolve(cached ? cached.data : null);
          }
        }, 100);
      });
    }

    // Fetch new data
    console.log(`Fetching fresh data for: ${key}`);
    this.loadingFlags.set(key, true);

    try {
      const data = await fetchFunction();
      this.cache.set(key, {
        data,
        timestamp: now
      });
      return data;
    } catch (error) {
      console.error(`Error fetching data for ${key}:`, error);
      throw error;
    } finally {
      this.loadingFlags.set(key, false);
    }
  }

  /**
   * Invalidate cache for a specific key
   */
  invalidate(key) {
    console.log(`Invalidating cache for: ${key}`);
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   */
  clearAll() {
    console.log('Clearing all cache');
    this.cache.clear();
  }

  /**
   * Check if data exists in cache and is still valid
   */
  isValid(key, cacheDuration = 120000) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    const now = Date.now();
    return (now - cached.timestamp) < cacheDuration;
  }
}

// Export singleton instance
export const dataCache = new DataCache();