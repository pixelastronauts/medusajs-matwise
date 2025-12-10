/**
 * Shared price cache that can be cleared from admin
 */

// From price cache - stores calculated "from prices" for products
export const fromPriceCache = new Map<string, { price: number; timestamp: number }>();
export const FROM_PRICE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Clear the from-price cache
 * Called when price lists are updated via admin
 */
export const clearFromPriceCache = () => {
  fromPriceCache.clear();
  console.log("[PRICE CACHE] From-price cache cleared");
};

/**
 * Clear all price caches
 */
export const clearAllPriceCaches = () => {
  clearFromPriceCache();
  console.log("[PRICE CACHE] All price caches cleared");
};

