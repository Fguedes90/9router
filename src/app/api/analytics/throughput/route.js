import { NextResponse } from "next/server";
import { calculateThroughputPercentiles } from "@/lib/analytics/percentileService.js";
import { getRequestDetailsDb } from "@/lib/requestDetailsDb.js";

/**
 * Maximum allowed date range in milliseconds (30 days)
 */
const MAX_DATE_RANGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Default percentiles to calculate
 */
const DEFAULT_PERCENTILES = ['p50', 'p95', 'p99'];

/**
 * Get unique values for a column
 * @param {object} db - SQLite database
 * @param {string} column - Column name
 * @returns {string[]}
 */
async function getUniqueValues(db, column) {
  if (!db.prepare) return [];
  
  const stmt = db.prepare(`SELECT DISTINCT ${column} FROM request_details WHERE ${column} IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL`);
  const rows = stmt.all();
  return rows.map(row => row[column]).filter(Boolean);
}

/**
 * Build filter object from query params
 * @param {object} query - Query parameters
 * @returns {{filter: object, error?: string}}
 */
function buildFilter(query) {
  const filter = {};
  
  if (query.provider) {
    filter.provider = query.provider;
  }
  
  if (query.model) {
    filter.model = query.model;
  }
  
  if (query.startDate) {
    const startDate = new Date(query.startDate);
    if (isNaN(startDate.getTime())) {
      return { filter: {}, error: 'Invalid startDate format' };
    }
    filter.startDate = startDate.toISOString();
  }
  
  if (query.endDate) {
    const endDate = new Date(query.endDate);
    if (isNaN(endDate.getTime())) {
      return { filter: {}, error: 'Invalid endDate format' };
    }
    filter.endDate = endDate.toISOString();
  }
  
  // Validate date range
  if (filter.startDate && filter.endDate) {
    const start = new Date(filter.startDate).getTime();
    const end = new Date(filter.endDate).getTime();
    const range = end - start;
    
    if (range < 0) {
      return { filter: {}, error: 'startDate must be before endDate' };
    }
    
    if (range > MAX_DATE_RANGE_MS) {
      return { filter: {}, error: 'Date range cannot exceed 30 days' };
    }
  }
  
  return { filter };
}

/**
 * Parse percentiles from query param
 * @param {string} value - Comma-separated percentiles (e.g., "p50,p95,p99")
 * @returns {string[]}
 */
function parsePercentiles(value) {
  if (!value) return DEFAULT_PERCENTILES;
  
  const parsed = value.split(',').map(p => p.trim().toLowerCase());
  const valid = ['p0', 'p25', 'p50', 'p75', 'p90', 'p95', 'p99', 'p100'];
  return parsed.filter(p => valid.includes(p));
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = Object.fromEntries(searchParams.entries());
    
    // Build filter and validate
    const { filter, error } = buildFilter(query);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    
    // Parse requested percentiles
    const percentiles = parsePercentiles(query.percentiles);
    
    // Get database for aggregations
    const db = await getRequestDetailsDb();
    
    // Calculate overall summary percentiles
    const summary = await calculateThroughputPercentiles(filter);
    
    // Build byProvider aggregation
    const byProvider = {};
    if (!query.provider && db.prepare) {
      const providers = await getUniqueValues(db, 'provider');
      for (const provider of providers) {
        const providerFilter = { ...filter, provider };
        byProvider[provider] = await calculateThroughputPercentiles(providerFilter);
      }
    }
    
    // Build byModel aggregation
    const byModel = {};
    if (!query.model && db.prepare) {
      const models = await getUniqueValues(db, 'model');
      for (const model of models) {
        const modelFilter = { ...filter, model };
        byModel[model] = await calculateThroughputPercentiles(modelFilter);
      }
    }
    
    // Build response with only requested percentiles
    const filterPercentiles = (data) => {
      const filtered = {};
      for (const p of percentiles) {
        if (data[p] !== undefined) {
          filtered[p] = data[p];
        }
      }
      filtered.sampleSize = data.sampleSize;
      filtered.calculatedAt = data.calculatedAt;
      return filtered;
    };
    
    const response = {
      summary: filterPercentiles(summary),
      percentiles,
      byProvider: Object.fromEntries(
        Object.entries(byProvider).map(([k, v]) => [k, filterPercentiles(v)])
      ),
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [k, filterPercentiles(v)])
      ),
      filter: {
        provider: filter.provider || null,
        model: filter.model || null,
        startDate: filter.startDate || null,
        endDate: filter.endDate || null
      }
    };
    
    // Add cache headers (cache for 5 minutes, same as percentileService cache)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('Error fetching throughput analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch throughput analytics' },
      { status: 500 }
    );
  }
}
