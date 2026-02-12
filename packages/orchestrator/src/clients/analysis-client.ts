import type { Logger } from '@a2a/core';

import { BaseAgentClient } from './base-client.js';

/**
 * HTTP client for the Analysis Agent.
 */
export class AnalysisClient extends BaseAgentClient {
  constructor(baseUrl: string, logger: Logger, timeout?: number) {
    super(baseUrl, logger, timeout);
  }

  protected getProcessEndpoint(): string {
    return '/api/v1/analysis/process';
  }

  protected getAgentName(): string {
    return 'analysis-agent';
  }
}
