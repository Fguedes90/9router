import { getRequestDetailsDb } from "../requestDetailsDb.js";

/**
 * In-memory cache for percentile calculations
 * @type {Map<string, {data: object, expiresAt: number}>}
 */
const percentileCache = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate cache key from filter parameters
 * @param {object} filter - Filter options
 * @returns {string}
 */
function generateCacheKey(filter) {
  const keyParts = [
    filter.provider || 'all',
    filter.model || 'all',
    filter.startDate || 'all',
    filter.endDate || 'all',
    filter.status || 'all'
  ];
  return keyParts.join('|');
}

/**
 * Calculate percentile using linear interpolation
 * @param {number[]} sortedData - Sorted array of values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number}
 */
function calculatePercentile(sortedData, percentile) {
  if (sortedData.length === 0) return 0;
  if (sortedData.length === 1) return sortedData[0];

  const index = (percentile / 100) * (sortedData.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sortedData[lower];
  }

  return sortedData[lower] * (1 - weight) + sortedData[upper] * weight;
}

/**
 * Stream throughput values from database using cursor-based iteration
 * Avoids loading all records into memory at once
 * @param {object} db - SQLite database instance
 * @param {object} filter - Filter options
 * @returns {Promise<number[]>}
 */
async function* streamThroughputValues(db, filter) {
  let query = 'SELECT throughput_tokens_per_sec FROM request_details WHERE throughput_tokens_per_sec IS NOT NULL';
  const params = [];

  if (filter.provider) {
    query += ' AND provider = ?';
    params.push(filter.provider);
  }

  if (filter.model) {
    query += ' AND model = ?';
    params.push(filter.model);
  }

  if (filter.startDate) {
    query += ' AND timestamp >= ?';
    params.push(new Date(filter.startDate).getTime());
  }

  if (filter.endDate) {
    query += ' AND timestamp <= ?';
    params.push(new Date(filter.endDate).getTime());
  }

  if (filter.status) {
    query += ' AND status = ?';
    params.push(filter.status);
  }

  query += ' ORDER BY throughput_tokens_per_sec ASC';

  // Use cursor-based streaming - fetch in batches
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const batchQuery = query + ' LIMIT ? OFFSET ?';
    const batchParams = [...params, batchSize, offset];
    const stmt = db.prepare(batchQuery);
    const rows = stmt.all(...batchParams);

    if (rows.length === 0) {
      hasMore = false;
    } else {
      for (const row of rows) {
        yield row.throughput_tokens_per_sec;
      }
      offset += batchSize;
      hasMore = rows.length === batchSize;
    }
  }
}

/**
 * Calculate throughput percentiles with caching
 * Supports filtering by provider, model, and date range
 * Uses streaming to handle large datasets efficiently
 * 
 * @param {object} filter - Filter options
 * @param {string} [filter.provider] - Filter by provider
 * @param {string} [filter.model] - Filter by model
 * @param {string} [filter.startDate] - Start date (ISO string)
 * @param {string} [filter.endDate] - End date (ISO string)
 * @param {string} [filter.status] - Filter by status
 * @returns {Promise<{p50: number, p95: number, p99: number, sampleSize: number, calculatedAt: number}>}
 */
export async function calculateThroughputPercentiles(filter = {}) {
  const cacheKey = generateCacheKey(filter);
  const now = Date.now();

  // Check cache first
  const cached = percentileCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const db = await getRequestDetailsDb();

  // Check if cloud environment (no SQLite)
  const isCloud = !db.prepare || db.name === 'mock';
  if (isCloud) {
    const result = {
      p50: 0,
      p95: 0,
      p99: 0,
      sampleSize: 0,
      calculatedAt: now
    };
    // Cache even empty results
    percentileCache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS });
    return result;
  }

  // Stream values from database using cursor
  const values = [];
  for await (const value of streamThroughputValues(db, filter)) {
    values.push(value);
  }

  // Calculate percentiles
  const sortedData = values.sort((a, b) => a - b);
  const p50 = calculatePercentile(sortedData, 50);
  const p95 = calculatePercentile(sortedData, 95);
  const p99 = calculatePercentile(sortedData, 99);

  const result = {
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    sampleSize: sortedData.length,
    calculatedAt: now
  };

  // Cache the result
  percentileCache.set(cacheKey, { data: result, expiresAt: now + CACHE_TTL_MS });

  // Cleanup old cache entries to prevent memory bloat
  if (percentileCache.size > 100) {
    const expiredKeys = [];
    for (const [key, value] of percentileCache.entries()) {
      if (value.expiresAt <= now) {
        expiredKeys.push(key);
      }
    }
    for (const key of expiredKeys) {
      percentileCache.delete(key);
    }
  }

  return result;
}

/**
 * Clear the percentile cache
 * Useful for testing or when data is known to have changed
 */
export function clearPercentileCache() {
  percentileCache.clear();
}

/**
 * Get cache statistics
 * @returns {{size: number, entries: Array<{key: string, expiresAt: number, isExpired: boolean}>}}
 */
export function getCacheStats() {
  const now = Date.now();
  const entries = [];
  for (const [key, value] of percentileCache.entries()) {
    entries.push({
      key,
      expiresAt: value.expiresAt,
      isExpired: value.expiresAt <= now
    });
  }
  return {
    size: percentileCache.size,
    entries
  };
}
