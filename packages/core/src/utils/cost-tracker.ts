/**
 * Token usage information for a single request.
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Aggregate metrics across multiple requests.
 */
export interface CostMetrics {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
}

/**
 * Gemini pricing per 1K tokens (as of January 2025).
 * These are example prices - adjust based on actual Vertex AI pricing.
 */
const PRICING = {
  // Gemini 1.5 Pro pricing (example)
  'gemini-1.5-pro': {
    input: 0.00125, // $1.25 per 1M input tokens = $0.00125 per 1K
    output: 0.00500, // $5.00 per 1M output tokens = $0.00500 per 1K
  },
  // Gemini 1.5 Flash pricing (example)
  'gemini-1.5-flash': {
    input: 0.000075, // $0.075 per 1M input tokens
    output: 0.000300, // $0.30 per 1M output tokens
  },
} as const;

type ModelName = keyof typeof PRICING;

/**
 * Calculate the estimated cost for token usage.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-1.5-pro'
): number {
  const modelKey = model.includes('flash') ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
  const pricing = PRICING[modelKey as ModelName];

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;

  return inputCost + outputCost;
}

/**
 * Track token usage and costs across multiple requests.
 */
export class CostTracker {
  private requests: TokenUsage[] = [];
  private model: string;

  constructor(model: string = 'gemini-1.5-pro') {
    this.model = model;
  }

  /**
   * Record token usage for a request.
   */
  trackUsage(inputTokens: number, outputTokens: number): TokenUsage {
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(inputTokens, outputTokens, this.model);

    const usage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
    };

    this.requests.push(usage);
    return usage;
  }

  /**
   * Get aggregate metrics for all tracked requests.
   */
  getMetrics(): CostMetrics {
    const totalRequests = this.requests.length;

    if (totalRequests === 0) {
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        averageTokensPerRequest: 0,
        averageCostPerRequest: 0,
      };
    }

    const totalInputTokens = this.requests.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = this.requests.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = this.requests.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = this.requests.reduce((sum, r) => sum + r.estimatedCost, 0);

    return {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCost,
      averageTokensPerRequest: totalTokens / totalRequests,
      averageCostPerRequest: totalCost / totalRequests,
    };
  }

  /**
   * Reset all tracked metrics.
   */
  reset(): void {
    this.requests = [];
  }
}
