import type { Logger } from '@a2a/core';

import { BaseAgentClient } from './base-client.js';

/**
 * HTTP client for the Research Agent.
 */
export class ResearchClient extends BaseAgentClient {
  constructor(baseUrl: string, logger: Logger, timeout?: number) {
    super(baseUrl, logger, timeout);
  }

  protected getProcessEndpoint(): string {
    return '/api/v1/research/process';
  }

  protected getAgentName(): string {
    return 'research-agent';
  }
}
