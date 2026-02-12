import type { Logger } from '@a2a/core';

import { BaseAgentClient } from './base-client.js';

/**
 * HTTP client for the Writer Agent.
 */
export class WriterClient extends BaseAgentClient {
  constructor(baseUrl: string, logger: Logger, timeout?: number) {
    super(baseUrl, logger, timeout);
  }

  protected getProcessEndpoint(): string {
    return '/api/v1/writer/process';
  }

  protected getAgentName(): string {
    return 'writer-agent';
  }
}
