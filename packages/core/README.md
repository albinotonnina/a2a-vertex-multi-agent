# @a2a/core

Core package providing shared utilities and abstractions for the A2A Multi-Agent System.

## Features

- **BaseAgent**: Abstract base class for building specialized agents
- **GeminiClient**: Vertex AI Gemini integration with retry logic
- **MCPClient**: Model Context Protocol client for tool servers
- **Utilities**: Logger, cost tracker, correlation IDs, retry logic

## Installation

```bash
pnpm add @a2a/core
```

## Usage

### Creating a New Agent

```typescript
import { BaseAgent, type Tool } from '@a2a/core';

export class MyAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return 'You are a specialized agent that...';
  }

  protected async registerTools(): Promise<Tool[]> {
    return [
      {
        name: 'my_tool',
        description: 'Does something useful',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          },
          required: ['input']
        },
        execute: async (params) => {
          // Tool implementation
          return { result: 'success' };
        }
      }
    ];
  }

  public getName(): string {
    return 'my-agent';
  }
}
```

### Using the Agent

```typescript
import { createLogger } from '@a2a/core';
import { MyAgent } from './agent.js';

const logger = createLogger({ name: 'my-agent' });

const agent = new MyAgent(
  {
    projectId: 'your-gcp-project',
    location: 'us-central1',
    model: 'gemini-1.5-pro',
  },
  logger
);

await agent.initialize();

const result = await agent.processRequest({
  query: 'What is quantum computing?',
});

console.log(result);
```

## API

### BaseAgent

Abstract base class that provides:

- `processRequest(input: AgentInput): Promise<AgentOutput>` - Process a request
- `initialize(): Promise<void>` - Initialize the agent (connect to MCP, etc.)
- `shutdown(): Promise<void>` - Cleanup resources
- `getMetrics()` - Get cost and usage metrics

Subclasses must implement:

- `getSystemPrompt(): string` - Define agent behavior
- `registerTools(): Promise<Tool[]>` - Define available tools
- `getName(): string` - Return agent identifier

### GeminiClient

Vertex AI Gemini client with:

- Retry logic (3 retries with exponential backoff)
- Token usage tracking
- Function calling support

### MCPClient

Model Context Protocol client with:

- SSE transport
- Tool discovery (`listTools()`)
- Tool invocation (`callTool()`)
- Connection lifecycle management

### Utilities

- `createLogger(config)` - Create structured logger
- `generateCorrelationId()` - Generate UUID for request tracing
- `CostTracker` - Track token usage and costs
- `retryWithBackoff(fn, options)` - Retry with exponential backoff

## Types

### AgentInput

```typescript
{
  correlationId?: string;
  query: string;
  context?: Record<string, unknown>;
  previousResults?: Array<{
    agentName: string;
    result: unknown;
  }>;
}
```

### AgentOutput

```typescript
{
  correlationId: string;
  result: string | Record<string, unknown>;
  metadata: {
    agentName: string;
    executionTime: number;
    tokenUsage: TokenUsage;
    toolsUsed: string[];
    iterations?: number;
  };
}
```

## Examples

See the specialized agent packages for complete examples:

- `@a2a/research-agent`
- `@a2a/analysis-agent`
- `@a2a/writer-agent`
