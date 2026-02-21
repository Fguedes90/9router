/**
 * Throughput calculation and token categorization utilities
 * Pure calculation functions - no dependencies
 */

/**
 * Calculate throughput in tokens per second
 * For streaming: uses output_duration_ms (ttft to last chunk)
 * For non-streaming: uses total latency
 * @param {number} completionTokens - Number of completion tokens
 * @param {number} latencyMs - Total latency in milliseconds (used for non-streaming)
 * @param {number} [outputDurationMs] - Output duration in milliseconds (used for streaming)
 * @returns {number|null} Throughput in tokens/second, or null for invalid input
 */
export function calculateThroughput(completionTokens, latencyMs, outputDurationMs) {
  // Handle invalid input
  if (
    completionTokens === undefined ||
    completionTokens === null ||
    completionTokens <= 0 ||
    latencyMs === undefined ||
    latencyMs === null ||
    latencyMs <= 0
  ) {
    return null;
  }

  // Use outputDurationMs for streaming, latencyMs for non-streaming
  const durationMs = outputDurationMs !== undefined && outputDurationMs !== null && outputDurationMs > 0
    ? outputDurationMs
    : latencyMs;

  // Handle division by zero
  if (durationMs <= 0) {
    return null;
  }

  // Convert to tokens per second
  // (tokens / milliseconds) * 1000 = tokens per second
  const throughput = (completionTokens / durationMs) * 1000;

  // Validate result
  if (!Number.isFinite(throughput) || throughput < 0) {
    return null;
  }

  return throughput;
}

/**
 * Categorize input tokens by size
 * @param {number} promptTokens - Number of prompt/input tokens
 * @returns {string|null} Category: 'low', 'medium', 'high', or null for invalid input
 */
export function categorizeInputTokens(promptTokens) {
  // Handle invalid input
  if (
    promptTokens === undefined ||
    promptTokens === null ||
    !Number.isFinite(promptTokens) ||
    promptTokens < 0
  ) {
    return null;
  }

  if (promptTokens < 500) {
    return 'low';
  } else if (promptTokens <= 2000) {
    return 'medium';
  } else {
    return 'high';
  }
}

/**
 * Categorize output tokens by size
 * @param {number} completionTokens - Number of completion/output tokens
 * @returns {string|null} Category: 'short', 'medium', 'long', or null for invalid input
 */
export function categorizeOutputTokens(completionTokens) {
  // Handle invalid input
  if (
    completionTokens === undefined ||
    completionTokens === null ||
    !Number.isFinite(completionTokens) ||
    completionTokens < 0
  ) {
    return null;
  }

  if (completionTokens < 100) {
    return 'short';
  } else if (completionTokens <= 500) {
    return 'medium';
  } else {
    return 'long';
  }
}
