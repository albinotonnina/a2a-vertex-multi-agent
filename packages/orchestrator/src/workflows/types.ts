import type { TokenUsage } from '@a2a/core';

/**
 * Input to a workflow execution.
 */
export interface WorkflowInput {
  /**
   * The user's query/task.
   */
  query: string;

  /**
   * Optional context to provide to agents.
   */
  context?: Record<string, unknown>;

  /**
   * Correlation ID for tracing (auto-generated if not provided).
   */
  correlationId?: string;
}

/**
 * Output from a workflow execution.
 */
export interface WorkflowOutput {
  /**
   * Correlation ID for tracing.
   */
  correlationId: string;

  /**
   * Final result from the workflow.
   */
  result: string | Record<string, unknown>;

  /**
   * Metadata about the workflow execution.
   */
  metadata: {
    /**
     * Name of the workflow.
     */
    workflowName: string;

    /**
     * Agents that were executed in order.
     */
    agents: Array<{
      name: string;
      executionTime: number;
      tokenUsage: TokenUsage;
      success: boolean;
    }>;

    /**
     * Total execution time in milliseconds.
     */
    totalExecutionTime: number;

    /**
     * Aggregated token usage across all agents.
     */
    totalTokenUsage: TokenUsage;

    /**
     * Total estimated cost across all agents.
     */
    totalCost: number;
  };

  /**
   * Intermediate results from each agent.
   */
  intermediateResults?: Array<{
    agentName: string;
    result: unknown;
  }>;
}
