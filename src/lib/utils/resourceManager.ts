'use client';

/**
 * Client-side compatible resource manager
 * Provides memory optimization and cache management
 */
class ResourceManager {
  private maxCacheSize: number = 1024 * 1024 * 1024; // 1GB max cache size (increased from 100MB)
  private currentCacheSize: number = 0;
  private memoryThreshold: number = 0.95; // 95% memory threshold (increased from 85%)
  
  // Store cache data with timestamps for expiration
  private memoryCache: Map<string, {
    data: any;
    size: number;
    timestamp: number;
    importance: number; // Higher = more important to keep
  }> = new Map();

  constructor() {
    console.log('Client ResourceManager initialized');
  }

  /**
   * Store an item in memory cache
   */
  setCache(key: string, data: any, importanceLevel: number = 1, ttlMs: number = 30 * 60 * 1000): void {
    // Calculate item size (approximate)
    const size = this.calculateObjectSize(data);
    
    // Check if we need to make room in the cache
    if (this.currentCacheSize + size > this.maxCacheSize) {
      this.evictCacheItems(size);
    }
    
    // Add or update item in cache
    this.memoryCache.set(key, {
      data,
      size,
      timestamp: Date.now(),
      importance: importanceLevel
    });
    
    this.currentCacheSize += size;
  }
  
  /**
   * Get an item from memory cache
   */
  getCache<T>(key: string): T | null {
    const item = this.memoryCache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Update timestamp to mark as recently used
    item.timestamp = Date.now();
    this.memoryCache.set(key, item);
    
    return item.data as T;
  }
  
  /**
   * Remove item from cache
   */
  removeCache(key: string): boolean {
    const item = this.memoryCache.get(key);
    
    if (item) {
      this.memoryCache.delete(key);
      this.currentCacheSize -= item.size;
      return true;
    }
    
    return false;
  }
  
  /**
   * Clear expired items from cache
   */
  clearExpiredCache(): number {
    const now = Date.now();
    let removedCount = 0;
    
    // Fix for ES5 compatibility - use Array.from instead of direct iteration
    Array.from(this.memoryCache.keys()).forEach(key => {
      const item = this.memoryCache.get(key);
      if (item && now - item.timestamp > 30 * 60 * 1000) {
        this.memoryCache.delete(key);
        this.currentCacheSize -= item.size;
        removedCount++;
      }
    });
    
    return removedCount;
  }
  
  /**
   * Evict items from cache to make room for new items
   */
  private evictCacheItems(sizeNeeded: number): void {
    // Sort items by importance and then by timestamp (ascending)
    const items = Array.from(this.memoryCache.entries())
      .sort((a, b) => {
        // First sort by importance (lower = less important)
        if (a[1].importance !== b[1].importance) {
          return a[1].importance - b[1].importance;
        }
        // Then sort by age (older first)
        return a[1].timestamp - b[1].timestamp;
      });
    
    let freedSpace = 0;
    
    for (const [key, item] of items) {
      this.memoryCache.delete(key);
      this.currentCacheSize -= item.size;
      freedSpace += item.size;
      
      // Stop once we've freed enough space
      if (freedSpace >= sizeNeeded) {
        break;
      }
    }
  }
  
  /**
   * Calculate approximate size of an object in bytes
   */
  private calculateObjectSize(obj: any): number {
    try {
      // Use JSON.stringify for a simple approximation
      const json = JSON.stringify(obj);
      // 2 bytes per character is a reasonable approximation
      return json.length * 2;
    } catch (e) {
      // If we can't stringify, make a conservative estimate
      return 10000; // 10KB default
    }
  }
  
  /**
   * Get current cache stats
   */
  getCacheStats(): {
    itemCount: number;
    totalSize: number;
    maxSize: number;
    utilization: number;
  } {
    return {
      itemCount: this.memoryCache.size,
      totalSize: this.currentCacheSize,
      maxSize: this.maxCacheSize,
      utilization: this.currentCacheSize / this.maxCacheSize
    };
  }

  /**
   * Check if system memory usage is high (client-side estimation)
   */
  isMemoryUsageHigh(): boolean {
    // In browsers, use performance API if available
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      return mem.usedJSHeapSize / mem.jsHeapSizeLimit > this.memoryThreshold;
    }
    
    // Fallback: use cache utilization as an approximation
    return this.currentCacheSize / this.maxCacheSize > this.memoryThreshold;
  }

  /**
   * Optimize memory in client environment
   */
  optimizeMemory(): boolean {
    // Clear expired cache items
    const removedCount = this.clearExpiredCache();
    return removedCount > 0;
  }

  /**
   * Request server-side cleanup after translation completes
   */
  async cleanupAfterTranslation(requestId: string): Promise<{
    deletedFiles: number;
    freedSpace: number;
  }> {
    console.log(`Requesting cleanup for request: ${requestId}`);
    
    try {
      // Call server endpoint to perform actual cleanup
      const response = await fetch('/api/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId })
      });
      
      if (response.ok) {
        const result = await response.json();
        return {
          deletedFiles: result.deletedFiles || 0,
          freedSpace: result.freedSpace || 0
        };
      }
    } catch (error) {
      console.error('Error requesting cleanup:', error);
    }
    
    // Return default values if cleanup request fails
    return {
      deletedFiles: 0,
      freedSpace: 0
    };
  }
}

// Create singleton instance
const resourceManager = new ResourceManager();
export default resourceManager; 