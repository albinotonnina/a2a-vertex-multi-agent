import { request } from 'undici';
import pRetry from 'p-retry';
import type { AgentInput, AgentOutput, Logger } from '@a2a/core';

/**
 * Base HTTP client for communicating with agent services.
 */
export abstract class BaseAgentClient {
  protected baseUrl: string;
  protected timeout: number;
  protected logger: Logger;

  constructor(baseUrl: string, logger: Logger, timeout: number = 30000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.logger = logger;
  }

  /**
   * Get the agent's processing endpoint path.
   */
  protected abstract getProcessEndpoint(): string;

  /**
   * Get the agent name for logging.
   */
  protected abstract getAgentName(): string;

  /**
   * Process a request with the agent.
   */
  async process(input: AgentInput): Promise<AgentOutput> {
    const endpoint = `${this.baseUrl}${this.getProcessEndpoint()}`;

    this.logger.info(
      {
        agent: this.getAgentName(),
        endpoint,
        correlationId: input.correlationId,
      },
      'Calling agent'
    );

    try {
      const result = await pRetry(
        async () => {
          const response = await request(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(input),
            bodyTimeout: this.timeout,
            headersTimeout: this.timeout,
          });

          if (response.statusCode !== 200) {
            const errorText = await response.body.text();
            throw new Error(
              `Agent returned status ${response.statusCode}: ${errorText}`
            );
          }

          const data = (await response.body.json()) as AgentOutput;
          return data;
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          factor: 2,
          onFailedAttempt: (error) => {
            this.logger.warn(
              {
                agent: this.getAgentName(),
                attempt: error.attemptNumber,
                error: error.message,
              },
              'Agent call failed, retrying...'
            );
          },
        }
      );

      this.logger.info(
        {
          agent: this.getAgentName(),
          correlationId: result.correlationId,
          executionTime: result.metadata.executionTime,
        },
        'Agent call completed'
      );

      return result;
    } catch (error) {
      this.logger.error(
        {
          agent: this.getAgentName(),
          error,
        },
        'Agent call failed after retries'
      );
      throw error;
    }
  }

  /**
   * Check agent health.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await request(`${this.baseUrl}/health`, {
        method: 'GET',
        headersTimeout: 5000,
      });

      return response.statusCode === 200;
    } catch (error) {
      this.logger.warn({ agent: this.getAgentName(), error }, 'Health check failed');
      return false;
    }
  }
}
