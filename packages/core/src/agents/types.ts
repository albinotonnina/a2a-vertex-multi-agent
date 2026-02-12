import type { TokenUsage } from '../utils/cost-tracker.js';

/**
 * Input to an agent request.
 */
export interface AgentInput {
  /**
   * Correlation ID for request tracing (auto-generated if not provided).
   */
  correlationId?: string;

  /**
   * The main query or task for the agent.
   */
  query: string;

  /**
   * Optional context from previous steps or external sources.
   */
  context?: Record<string, unknown>;

  /**
   * Results from previous agents in a workflow.
   */
  previousResults?: Array<{
    agentName: string;
    result: unknown;
  }>;
}

/**
 * Output from an agent request.
 */
export interface AgentOutput {
  /**
   * Correlation ID for request tracing.
   */
  correlationId: string;

  /**
   * The agent's response/result.
   */
  result: string | Record<string, unknown>;

  /**
   * Metadata about the request execution.
   */
  metadata: {
    /**
     * Name of the agent that processed the request.
     */
    agentName: string;

    /**
     * Execution time in milliseconds.
     */
    executionTime: number;

    /**
     * Token usage and cost information.
     */
    tokenUsage: TokenUsage;

    /**
     * Tools that were invoked during execution.
     */
    toolsUsed: string[];

    /**
     * Number of function calling iterations.
     */
    iterations?: number;

    /**
     * Any errors encountered (non-fatal).
     */
    warnings?: string[];
  };
}

/**
 * Tool definition for agent capabilities.
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  /**
   * Execute the tool with given parameters.
   */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}
