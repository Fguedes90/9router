import { getRequestDetailsDb } from "../requestDetailsDb.js";
import { calculateThroughputPercentiles } from "./percentileService.js";
import { getHourlyAggregations } from "./aggregationJob.js";

/**
 * Input token category thresholds
 * @type {object}
 */
const INPUT_CATEGORIES = {
  LOW: { max: 1000, label: 'low' },
  MEDIUM: { max: 8000, label: 'medium' },
  HIGH: { max: Infinity, label: 'high' }
};

/**
 * Use case weights for recommendation scoring
 * @type {object}
 */
const USE_CASE_WEIGHTS = {
  coding: { speed: 0.6, reliability: 0.3, cost: 0.1 },
  general: { speed: 0.3, reliability: 0.4, cost: 0.3 },
  reasoning: { speed: 0.2, reliability: 0.5, cost: 0.3 },
  fast: { speed: 0.7, reliability: 0.2, cost: 0.1 },
  cheap: { speed: 0.1, reliability: 0.3, cost: 0.6 },
  default: { speed: 0.33, reliability: 0.33, cost: 0.34 }
};

/**
 * Determine input category based on token count
 * @param {number} inputTokens - Number of input tokens
 * @returns {string} Category label: 'low', 'medium', or 'high'
 */
function categorizeInput(inputTokens) {
  if (inputTokens <= INPUT_CATEGORIES.LOW.max) {
    return INPUT_CATEGORIES.LOW.label;
  } else if (inputTokens <= INPUT_CATEGORIES.MEDIUM.max) {
    return INPUT_CATEGORIES.MEDIUM.label;
  }
  return INPUT_CATEGORIES.HIGH.label;
}

/**
 * Get use case weights or default
 * @param {string} useCase - Use case identifier
 * @returns {object} Weights object
 */
function getUseCaseWeights(useCase) {
  const normalizedUseCase = useCase?.toLowerCase().trim() || 'default';
  return USE_CASE_WEIGHTS[normalizedUseCase] || USE_CASE_WEIGHTS.default;
}

/**
 * Calculate recommendation score for a provider
 * @param {object} stats - Provider statistics
 * @param {object} weights - Use case weights
 * @param {string} inputCategory - Input category
 * @returns {number} Score (0-100)
 */
function calculateScore(stats, weights) {
  const { p50, p95, sampleSize } = stats;
  
  // Skip providers with insufficient data
  if (!p50 || p50 === 0 || sampleSize < 5) {
    return 0;
  }
  
  // Speed score based on p50 throughput (normalize to 0-100 scale)
  // Assume max throughput is ~100 tokens/sec for scoring
  const speedScore = Math.min(100, (p50 / 100) * 100);
  
  // Reliability score based on p95/p50 ratio (closer = more consistent)
  const reliabilityScore = p95 > 0 
    ? Math.max(0, 100 - ((p95 - p50) / p50) * 100)
    : 50;
  
  // Cost score is handled at combo level, here assume neutral
  const costScore = 50;
  
  // Weighted final score
  const score = (
    speedScore * weights.speed +
    reliabilityScore * weights.reliability +
    costScore * weights.cost
  );
  
  return Math.round(score * 10) / 10;
}

/**
 * Generate reasoning text for recommendation
 * @param {object} stats - Provider statistics
 * @param {string} inputCategory - Input category

 * @returns {string} Human-readable reasoning
 */
function generateReasoning(stats, inputCategory) {
  const reasons = [];
  
  if (stats.p50 && stats.p50 > 0) {
    reasons.push(`${stats.p50} tokens/sec p50 throughput`);
  }
  
  if (stats.p95 && stats.p95 > 0) {
    reasons.push(`${stats.p95} tokens/sec p95`);
  }
  
  if (stats.sampleSize < 20) {
    reasons.push(`limited data (${stats.sampleSize} samples)`);
  } else {
    reasons.push(`${stats.sampleSize} samples`);
  }
  
  reasons.push(`input category: ${inputCategory}`);
  
  return reasons.join(' · ');
}

/**
 * Query throughput data for a specific provider and input category
 * @param {string} provider - Provider name
 * @param {string} inputCategory - Input token category
 * @returns {Promise<object>} Throughput statistics
 */
async function getProviderStats(provider, inputCategory) {
  const db = await getRequestDetailsDb();
  
  // Check if cloud environment (no SQLite)
  const isCloud = !db.prepare || db.name === 'mock';
  if (isCloud) {
    return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
  }
  
  // Build filter based on provider and input category
  const filter = { provider };
  
  // If we have input_category column data, filter by it
  if (inputCategory !== 'all') {
    // Note: input_category may not be populated for all historical data
    // Fall back to overall stats if needed
  }
  
  try {
    // Get percentiles for this provider
    const stats = await calculateThroughputPercentiles(filter);
    return stats;
  } catch (error) {
    console.error(`[recommendations] Error fetching stats for ${provider}:`, error.message);
    return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
  }
}

/**
 * Get available providers with throughput data
 * @returns {Promise<string[]>} List of provider names with data
 */
async function getAvailableProviders() {
  const db = await getRequestDetailsDb();
  
  const isCloud = !db.prepare || db.name === 'mock';
  if (isCloud) {
    return [];
  }
  
  try {
    const stmt = db.prepare(`
      SELECT DISTINCT provider 
      FROM request_details 
      WHERE provider IS NOT NULL 
        AND throughput_tokens_per_sec IS NOT NULL
        AND throughput_tokens_per_sec > 0
    `);
    const rows = stmt.all();
    return rows.map(row => row.provider).filter(Boolean);
  } catch (error) {
    console.error('[recommendations] Error fetching providers:', error.message);
    return [];
  }
}

/**
 * Get throughput data for all providers
 * @param {string} inputCategory - Input token category
 * @returns {Promise<object>} Map of provider -> stats
 */
async function getAllProviderStats(inputCategory) {
  const providers = await getAvailableProviders();
  const statsMap = {};
  
  for (const provider of providers) {
    const stats = await getProviderStats(provider, inputCategory);
    statsMap[provider] = stats;
  }
  
  return statsMap;
}

/**
 * Main recommendation function
 * Analyzes throughput data to suggest best provider per input size
 * 
 * @param {number} inputTokens - Number of input tokens
 * @param {string} useCase - Use case (coding, general, reasoning, fast, cheap)
 * @returns {Promise<object>} Ranked recommendations with reasoning
 */
export async function getRecommendations(inputTokens, useCase = 'default') {
  const inputCategory = categorizeInput(inputTokens);
  const weights = getUseCaseWeights(useCase);
  
  // Get current aggregation data as a quick source
  const aggregations = getHourlyAggregations();
  
  // Also query for provider-level stats
  const providerStats = await getAllProviderStats(inputCategory);
  
  // Combine data sources and calculate scores
  const recommendations = [];
  
  // Process aggregations (provider|model format)
  for (const [key, agg] of aggregations) {
    const [provider] = key.split('|');
    
    // Get broader provider stats
    const broaderStats = providerStats[provider] || { p50: 0, p95: 0, sampleSize: 0 };
    
    // Use aggregation data if available, fallback to provider stats
    const stats = agg.sampleCount > 0 
      ? { 
          p50: agg.avgThroughput, 
          p95: agg.maxThroughput, 
          sampleSize: agg.sampleCount 
        }
      : broaderStats;
    
    const score = calculateScore(stats, weights);
    
    if (score > 0) {
      recommendations.push({
        provider,
        model: agg.model,
        score,
        stats: {
          p50: stats.p50,
          p95: stats.p95,
          sampleSize: stats.sampleSize
        },
        reasoning: generateReasoning(stats, inputCategory)
      });
    }
  }
  
  // Also add providers without specific model data
  for (const [provider, stats] of Object.entries(providerStats)) {
    // Skip if we already have this provider from aggregations
    if (recommendations.some(r => r.provider === provider)) {
      continue;
    }
    
    const score = calculateScore(stats, weights);
    
    if (score > 0) {
      recommendations.push({
        provider,
        model: null,
        score,
        stats: {
          p50: stats.p50,
          p95: stats.p95,
          sampleSize: stats.sampleSize
        },
        reasoning: generateReasoning(stats, inputCategory)
      });
    }
  }
  
  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);
  
  // Return top 5 recommendations
  const topRecommendations = recommendations.slice(0, 5);
  
  return {
    inputTokens,
    inputCategory,
    useCase,
    weights,
    recommendations: topRecommendations,
    totalProvidersAnalyzed: recommendations.length,
    generatedAt: Date.now()
  };
}

/**
 * Get recommendations summary for a specific category
 * Useful for dashboard display
 * 
 * @param {string} inputCategory - Category: 'low', 'medium', 'high'
 * @param {string} useCase - Use case
 * @returns {Promise<object>} Summary of best provider per category
 */
export async function getCategorySummary(useCase = 'default') {
  const categoryTokenRanges = {
    low: 500,
    medium: 4000,
    high: 12000
  };
  
  const summary = {};
  
  for (const [category, tokens] of Object.entries(categoryTokenRanges)) {
    const result = await getRecommendations(tokens, useCase);
    summary[category] = {
      inputTokens: tokens,
      topProvider: result.recommendations[0]?.provider || null,
      topScore: result.recommendations[0]?.score || 0,
      topModel: result.recommendations[0]?.model || null,
      alternatives: result.recommendations.slice(1, 4).map(r => ({
        provider: r.provider,
        model: r.model,
        score: r.score
      }))
    };
  }
  
  return summary;
}

export default {
  getRecommendations,
  getCategorySummary,
  categorizeInput,
  getUseCaseWeights
};
