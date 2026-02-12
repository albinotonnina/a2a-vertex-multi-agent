import { ensureCorrelationId, type Logger } from '@a2a/core';

import type { ResearchClient } from '../clients/research-client.js';
import type { AnalysisClient } from '../clients/analysis-client.js';
import type { WriterClient } from '../clients/writer-client.js';

import type { WorkflowInput, WorkflowOutput } from './types.js';

/**
 * Research → Analysis → Writer workflow.
 *
 * This workflow:
 * 1. Uses Research Agent to gather information
 * 2. Uses Analysis Agent to interpret findings
 * 3. Uses Writer Agent to create final report
 */
export class ResearchAnalysisWriterWorkflow {
  private researchClient: ResearchClient;
  private analysisClient: AnalysisClient;
  private writerClient: WriterClient;
  private logger: Logger;

  constructor(
    researchClient: ResearchClient,
    analysisClient: AnalysisClient,
    writerClient: WriterClient,
    logger: Logger
  ) {
    this.researchClient = researchClient;
    this.analysisClient = analysisClient;
    this.writerClient = writerClient;
    this.logger = logger;
  }

  /**
   * Execute the workflow.
   */
  async execute(input: WorkflowInput): Promise<WorkflowOutput> {
    const startTime = Date.now();
    const correlationId = ensureCorrelationId(input.correlationId);

    this.logger.info(
      {
        correlationId,
        query: input.query,
        workflow: 'research-analysis-writer',
      },
      'Starting workflow execution'
    );

    const agentResults: WorkflowOutput['metadata']['agents'] = [];
    const intermediateResults: Array<{ agentName: string; result: unknown }> = [];

    try {
      // Step 1: Research
      this.logger.info({ correlationId }, 'Step 1: Executing research agent');
      const researchStartTime = Date.now();

      const researchResult = await this.researchClient.process({
        correlationId,
        query: input.query,
        context: input.context,
      });

      agentResults.push({
        name: 'research-agent',
        executionTime: Date.now() - researchStartTime,
        tokenUsage: researchResult.metadata.tokenUsage,
        success: true,
      });

      intermediateResults.push({
        agentName: 'research-agent',
        result: researchResult.result,
      });

      this.logger.info(
        { correlationId, executionTime: agentResults[0]?.executionTime },
        'Research agent completed'
      );

      // Step 2: Analysis
      this.logger.info({ correlationId }, 'Step 2: Executing analysis agent');
      const analysisStartTime = Date.now();

      const analysisResult = await this.analysisClient.process({
        correlationId,
        query: input.query,
        context: input.context,
        previousResults: [
          {
            agentName: 'research-agent',
            result: researchResult.result,
          },
        ],
      });

      agentResults.push({
        name: 'analysis-agent',
        executionTime: Date.now() - analysisStartTime,
        tokenUsage: analysisResult.metadata.tokenUsage,
        success: true,
      });

      intermediateResults.push({
        agentName: 'analysis-agent',
        result: analysisResult.result,
      });

      this.logger.info(
        { correlationId, executionTime: agentResults[1]?.executionTime },
        'Analysis agent completed'
      );

      // Step 3: Writer
      this.logger.info({ correlationId }, 'Step 3: Executing writer agent');
      const writerStartTime = Date.now();

      const writerResult = await this.writerClient.process({
        correlationId,
        query: `Create a comprehensive report based on the research and analysis. ${input.query}`,
        context: input.context,
        previousResults: [
          {
            agentName: 'research-agent',
            result: researchResult.result,
          },
          {
            agentName: 'analysis-agent',
            result: analysisResult.result,
          },
        ],
      });

      agentResults.push({
        name: 'writer-agent',
        executionTime: Date.now() - writerStartTime,
        tokenUsage: writerResult.metadata.tokenUsage,
        success: true,
      });

      this.logger.info(
        { correlationId, executionTime: agentResults[2]?.executionTime },
        'Writer agent completed'
      );

      // Aggregate metrics
      const totalExecutionTime = Date.now() - startTime;
      const totalTokenUsage = agentResults.reduce(
        (acc, agent) => ({
          inputTokens: acc.inputTokens + agent.tokenUsage.inputTokens,
          outputTokens: acc.outputTokens + agent.tokenUsage.outputTokens,
          totalTokens: acc.totalTokens + agent.tokenUsage.totalTokens,
          estimatedCost: acc.estimatedCost + agent.tokenUsage.estimatedCost,
        }),
        {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        }
      );

      this.logger.info(
        {
          correlationId,
          totalExecutionTime,
          totalCost: totalTokenUsage.estimatedCost,
          agents: agentResults.length,
        },
        'Workflow completed successfully'
      );

      return {
        correlationId,
        result: writerResult.result,
        metadata: {
          workflowName: 'research-analysis-writer',
          agents: agentResults,
          totalExecutionTime,
          totalTokenUsage,
          totalCost: totalTokenUsage.estimatedCost,
        },
        intermediateResults,
      };
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;

      this.logger.error(
        {
          correlationId,
          error,
          totalExecutionTime,
          completedAgents: agentResults.length,
        },
        'Workflow execution failed'
      );

      throw error;
    }
  }
}
