import { getRequestDetailsDb } from "../requestDetailsDb.js";

/**
 * Aggregation Job for throughput monitoring
 * Pre-calculates hourly aggregations for provider/model combinations
 * Runs every 5 minutes to update in-memory stats
 */

// In-memory aggregation cache
const hourlyAggregations = new Map();

// Interval reference
let aggregationInterval = null;

// Running state
let isRunning = false;

/**
 * Aggregation interval in ms (5 minutes)
 */
const AGGREGATION_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Get the hour key for a timestamp
 * @param {number} timestamp - Unix timestamp in ms
 * @returns {string} Hour key in format "YYYY-MM-DDTHH"
 */
function getHourKey(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().slice(0, 13); // "2024-01-15T14"
}

/**
 * Get the provider-model key
 * @param {string} provider
 * @param {string} model
 * @returns {string}
 */
function getProviderModelKey(provider, model) {
  return `${provider}|${model}`;
}

/**
 * Perform hourly aggregation calculation
 * Queries the request_details table and calculates averages per provider/model
 * @returns {Promise<object>} Aggregated data
 */
async function performAggregation() {
  const db = await getRequestDetailsDb();
  
  // Check if cloud environment (no SQLite)
  const isCloud = !db.prepare || db.name === 'mock';
  if (isCloud) {
    console.log('[aggregationJob] Skipping aggregation in cloud environment');
    return hourlyAggregations;
  }
  
  try {
    // Get the last 2 hours of data for rolling hourly averages
    const now = Date.now();
    const twoHoursAgo = now - (2 * 60 * 60 * 1000);
    
    // Query to get hourly throughput per provider/model
    // Using a time-bucketed approach
    const stmt = db.prepare(`
      SELECT 
        provider,
        model,
        AVG(throughput_tokens_per_sec) as avg_throughput,
        MIN(throughput_tokens_per_sec) as min_throughput,
        MAX(throughput_tokens_per_sec) as max_throughput,
        COUNT(*) as sample_count,
        AVG(CASE WHEN output_duration_ms > 0 THEN output_duration_ms END) as avg_output_duration_ms
      FROM request_details
      WHERE timestamp >= ? 
        AND throughput_tokens_per_sec IS NOT NULL
        AND throughput_tokens_per_sec > 0
      GROUP BY provider, model
      ORDER BY avg_throughput DESC
    `);
    
    const results = stmt.all(twoHoursAgo);
    
    // Update in-memory aggregations
    const newAggregations = new Map();
    
    for (const row of results) {
      const key = getProviderModelKey(row.provider, row.model);
      const aggregation = {
        provider: row.provider,
        model: row.model,
        avgThroughput: Math.round(row.avg_throughput * 100) / 100,
        minThroughput: Math.round(row.min_throughput * 100) / 100,
        maxThroughput: Math.round(row.max_throughput * 100) / 100,
        sampleCount: row.sample_count,
        avgOutputDurationMs: row.avg_output_duration_ms ? Math.round(row.avg_output_duration_ms) : null,
        calculatedAt: now,
        hourKey: getHourKey(now)
      };
      newAggregations.set(key, aggregation);
    }
    
    // Replace old aggregations atomically
    hourlyAggregations.clear();
    for (const [key, value] of newAggregations) {
      hourlyAggregations.set(key, value);
    }
    
    console.log(`[aggregationJob] Updated hourly aggregations for ${newAggregations.size} provider-model combinations`);
    
    return hourlyAggregations;
  } catch (error) {
    console.error('[aggregationJob] Aggregation failed:', error.message);
    return hourlyAggregations;
  }
}

/**
 * Start the aggregation background job
 * Runs immediately, then every 5 minutes
 * @returns {Promise<void>}
 */
export async function startAggregationJob() {
  if (isRunning) {
    console.log('[aggregationJob] Already running');
    return;
  }
  
  isRunning = true;
  console.log('[aggregationJob] Starting aggregation job');
  
  // Run immediately (non-blocking)
  performAggregation().catch(err => {
    console.error('[aggregationJob] Initial aggregation failed:', err.message);
  });
  
  // Schedule recurring runs
  aggregationInterval = setInterval(() => {
    performAggregation().catch(err => {
      console.error('[aggregationJob] Scheduled aggregation failed:', err.message);
    });
  }, AGGREGATION_INTERVAL_MS);
  
  // Don't prevent process from exiting
  if (aggregationInterval.unref) {
    aggregationInterval.unref();
  }
  
  console.log(`[aggregationJob] Aggregation job scheduled (every ${AGGREGATION_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the aggregation background job
 * @returns {Promise<void>}
 */
export async function stopAggregationJob() {
  if (!isRunning) {
    console.log('[aggregationJob] Not running');
    return;
  }
  
  console.log('[aggregationJob] Stopping aggregation job');
  
  if (aggregationInterval) {
    clearInterval(aggregationInterval);
    aggregationInterval = null;
  }
  
  isRunning = false;
  console.log('[aggregationJob] Aggregation job stopped');
}

/**
 * Get current hourly aggregations
 * @returns {Map<string, object>} Map of provider|model -> aggregation data
 */
export function getHourlyAggregations() {
  return new Map(hourlyAggregations);
}

/**
 * Get aggregation for a specific provider/model
 * @param {string} provider
 * @param {string} model
 * @returns {object|null}
 */
export function getAggregation(provider, model) {
  const key = getProviderModelKey(provider, model);
  return hourlyAggregations.get(key) || null;
}

/**
 * Check if aggregation job is running
 * @returns {boolean}
 */
export function isAggregationJobRunning() {
  return isRunning;
}
