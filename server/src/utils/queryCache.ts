/**
 * Simple in-memory cache utility for database queries
 * Use for read-heavy endpoints that don't change frequently
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class QueryCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;

  constructor(defaultTTLSeconds: number = 300) {
    this.cache = new Map();
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > this.defaultTTL;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Store data in cache
   */
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Create singleton instance with 5-minute TTL
export const queryCache = new QueryCache(300);

/**
 * Middleware wrapper for caching GET requests
 * Usage:
 * router.get('/endpoint', cacheMiddleware('endpoint-key'), async (req, res) => {...})
 */
export const cacheMiddleware = (cacheKey: string, ttlSeconds?: number) => {
  const cache = ttlSeconds ? new QueryCache(ttlSeconds) : queryCache;
  
  return (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Build cache key with query params
    const fullKey = `${cacheKey}:${JSON.stringify(req.query)}`;
    
    // Check cache
    const cachedData = cache.get(fullKey);
    
    if (cachedData) {
      console.log(`Cache HIT: ${fullKey}`);
      return res.json(cachedData);
    }
    
    console.log(`Cache MISS: ${fullKey}`);
    
    // Store original res.json function
    const originalJson = res.json.bind(res);
    
    // Override res.json to cache response
    res.json = (data: any) => {
      cache.set(fullKey, data);
      return originalJson(data);
    };
    
    next();
  };
};

/**
 * Helper to invalidate cache when data changes
 * Call this after POST/PUT/DELETE operations that modify data
 */
export const invalidateCache = (pattern?: string) => {
  if (!pattern) {
    queryCache.clear();
    console.log('Cache cleared: all entries');
    return;
  }
  
  const stats = queryCache.getStats();
  const keysToDelete = stats.keys.filter(key => key.includes(pattern));
  
  keysToDelete.forEach(key => queryCache.delete(key));
  console.log(`Cache cleared: ${keysToDelete.length} entries matching '${pattern}'`);
};
