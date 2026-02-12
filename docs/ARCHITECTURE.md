# A2A System Architecture

This document provides an in-depth look at the A2A system architecture, design decisions, and implementation patterns.

## Overview

A2A (Agent-to-Agent) is a distributed system where specialized AI agents communicate via REST APIs to accomplish complex tasks collaboratively. The system demonstrates production-ready patterns for building multi-agent systems.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                           User/Client                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ HTTP POST /api/v1/workflow/execute
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                       Orchestrator                               │
│  - Workflow Management                                           │
│  - Agent HTTP Clients (with retry)                              │
│  - Context Aggregation                                           │
│  - Metrics Collection                                            │
└──┬────────────────┬────────────────┬────────────────────────────┘
   │                │                │
   │ HTTP           │ HTTP           │ HTTP
   │                │                │
┌──▼──────┐    ┌───▼──────┐    ┌───▼──────┐
│Research │    │Analysis  │    │Writer    │
│Agent    │    │Agent     │    │Agent     │
│Port 3001│    │Port 3002 │    │Port 3003 │
└──┬──────┘    └──────────┘    └──────────┘
   │
   │ MCP SSE Connection
   │
┌──▼──────────────────────┐
│ MCP Web Search Server   │
│ Port 3100               │
└─────────────────────────┘
```

## Core Components

### 1. Core Package (@a2a/core)

The foundation of the system, providing shared abstractions and utilities.

#### BaseAgent

Abstract base class that all agents extend:

```typescript
export abstract class BaseAgent {
  protected geminiClient: GeminiClient;
  protected mcpClient: MCPClient | null;
  protected logger: Logger;
  protected costTracker: CostTracker;

  // Subclasses must implement:
  protected abstract getSystemPrompt(): string;
  protected abstract registerTools(): Promise<Tool[]>;
  public abstract getName(): string;

  // Core functionality:
  async processRequest(input: AgentInput): Promise<AgentOutput> {
    // 1. Generate correlation ID
    // 2. Build prompt with context
    // 3. Execute function calling loop
    // 4. Track costs and metrics
    // 5. Return structured response
  }
}
```

**Design Decision**: Abstract base class provides:
- Consistent behavior across all agents
- Built-in observability (logging, correlation IDs)
- Standardized error handling
- Cost tracking
- Function calling integration

#### GeminiClient

Wrapper around Vertex AI Gemini SDK:

- Retry logic with exponential backoff
- Token usage tracking
- Function calling support
- Error handling and logging

**Trade-off**: Direct SDK integration vs. abstraction
- Pro: Type safety, full SDK feature access
- Con: Tight coupling to Vertex AI (mitigated by interface design)

#### MCPClient

Client for Model Context Protocol servers:

- SSE transport for real-time communication
- Tool discovery (`listTools()`)
- Tool invocation (`callTool()`)
- Connection lifecycle management

**Design Decision**: MCP for tool integration
- Pro: Standard protocol, tool server independence
- Pro: Can add tools without modifying agents
- Con: Additional network hop for tool calls

### 2. Agent Services

Each agent is a specialized microservice:

#### Research Agent
- **Purpose**: Information gathering
- **Tools**: MCP web search
- **System Prompt**: Focused on finding accurate, cited information

#### Analysis Agent
- **Purpose**: Data interpretation
- **Tools**: Statistical extraction (local)
- **System Prompt**: Focused on deriving insights

#### Writer Agent
- **Purpose**: Content creation
- **Tools**: Markdown formatting (local)
- **System Prompt**: Focused on clear, structured writing

**Design Pattern**: Single Responsibility Principle
- Each agent has one clear purpose
- Prompts are specialized and focused
- Easy to add new specialized agents

### 3. Orchestrator

Coordinates multi-agent workflows:

```typescript
class ResearchAnalysisWriterWorkflow {
  async execute(input: WorkflowInput): Promise<WorkflowOutput> {
    // 1. Call Research Agent
    const research = await researchClient.process({...});

    // 2. Call Analysis Agent (with research results)
    const analysis = await analysisClient.process({
      previousResults: [{ agentName: 'research', result: research }]
    });

    // 3. Call Writer Agent (with all previous results)
    const final = await writerClient.process({
      previousResults: [research, analysis]
    });

    // 4. Aggregate metrics and return
    return { result: final, metadata: {...} };
  }
}
```

**Design Decision**: Sequential execution
- **Current**: Research → Analysis → Writer (sequential)
- **Alternative**: Parallel execution where possible
- **Trade-off**: Simpler logic vs. faster execution

### 4. MCP Tool Servers

Example: Web Search Server

```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'web_search',
    description: 'Search the web',
    inputSchema: {...}
  }]
}));

server.setRequestHandler('tools/call', async (request) => {
  const results = await performWebSearch(request.params.arguments.query);
  return { content: [{ type: 'text', text: results }] };
});
```

**Design Decision**: Separate MCP servers
- Pro: Tool servers can be developed independently
- Pro: Can use different languages/frameworks
- Pro: Easy to add/remove tools
- Con: Additional services to manage

## Data Flow

### Request Flow

1. **User Request** → Orchestrator
   ```json
   { "query": "Research quantum computing" }
   ```

2. **Orchestrator** → Research Agent
   ```json
   {
     "correlationId": "uuid",
     "query": "Research quantum computing",
     "context": {}
   }
   ```

3. **Research Agent** → Gemini API
   - System prompt + user query
   - Available tools: web_search

4. **Gemini** → Research Agent (function call)
   ```json
   { "functionCall": { "name": "web_search", "args": {...} } }
   ```

5. **Research Agent** → MCP Server
   - Execute web_search tool

6. **MCP Server** → Research Agent
   - Return search results

7. **Research Agent** → Gemini (with results)
   - Function response

8. **Gemini** → Research Agent (final answer)
   - Synthesized research findings

9. **Research Agent** → Orchestrator
   ```json
   {
     "correlationId": "uuid",
     "result": "Research findings...",
     "metadata": { "tokenUsage": {...}, "executionTime": 5000 }
   }
   ```

10. **Orchestrator** → Analysis Agent (with research results)

11. Similar flow for Analysis and Writer agents

12. **Orchestrator** → User (final response)

### Context Passing

Each agent receives context from previous agents:

```typescript
{
  query: "Original user query",
  previousResults: [
    {
      agentName: "research-agent",
      result: "Research findings..."
    },
    {
      agentName: "analysis-agent",
      result: "Analysis insights..."
    }
  ]
}
```

The `buildPrompt()` method in BaseAgent formats this into the Gemini prompt:

```
SYSTEM INSTRUCTIONS:
[Agent-specific system prompt]

PREVIOUS AGENT RESULTS:
--- research-agent ---
[Research findings]

--- analysis-agent ---
[Analysis insights]

USER QUERY:
[Original query]
```

## Observability

### Correlation IDs

Every request gets a UUID that flows through all agents:

```
User → Orchestrator (generate UUID)
  → Research Agent (propagate UUID)
    → MCP Server (propagate UUID)
  → Analysis Agent (same UUID)
  → Writer Agent (same UUID)
→ User (return UUID)
```

All logs include the correlation ID:

```json
{
  "level": "info",
  "correlationId": "abc-123",
  "agent": "research-agent",
  "msg": "Processing request"
}
```

### Cost Tracking

Every Gemini API call is tracked:

```typescript
const usage = costTracker.trackUsage(inputTokens, outputTokens);
// Returns: { inputTokens, outputTokens, totalTokens, estimatedCost }
```

Costs are aggregated at the orchestrator level:

```typescript
totalCost = sum(agents.map(a => a.tokenUsage.estimatedCost))
```

### Structured Logging

All services use Pino for structured JSON logging:

- Development: Pretty-printed to console
- Production: JSON for log aggregation systems

## Error Handling

### Retry Strategy

HTTP calls to agents use p-retry with exponential backoff:

```typescript
await pRetry(
  async () => request(agentUrl, {...}),
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,  // Exponential backoff
  }
);
```

### Circuit Breaking

Future enhancement: Implement circuit breaker pattern to prevent cascading failures.

### Graceful Degradation

Currently: Fail-fast on agent errors
Future: Return partial results if some agents succeed

## Scaling Considerations

### Horizontal Scaling

Each service can be scaled independently:

```yaml
# docker-compose.yml
research-agent:
  deploy:
    replicas: 3
```

Add load balancer in front of agents.

### Caching

Future optimization:
- Cache Gemini responses for repeated queries
- Use Redis for distributed caching
- Implement cache invalidation strategy

### Parallel Execution

Current workflow is sequential. Can parallelize independent steps:

```typescript
// Parallel research on multiple topics
const [topic1, topic2] = await Promise.all([
  researchClient.process({ query: "Topic 1" }),
  researchClient.process({ query: "Topic 2" })
]);
```

## Security Considerations

### Authentication

Current: No authentication (for development)
Production: Add:
- API key authentication
- JWT tokens
- mTLS between services

### Authorization

Current: All requests allowed
Production: Add:
- Role-based access control
- Rate limiting per API key
- Request validation

### Secrets Management

Current: Environment variables
Production: Use:
- Google Secret Manager
- Kubernetes Secrets
- HashiCorp Vault

## Cost Optimization

### Model Selection

```bash
# Cheaper/faster for simple tasks
GEMINI_MODEL=gemini-1.5-flash

# More capable for complex tasks
GEMINI_MODEL=gemini-1.5-pro
```

### Token Management

- Minimize system prompt length
- Limit context from previous agents
- Use appropriate `maxOutputTokens`

### Caching

Implement response caching to avoid redundant API calls.

## Deployment Architecture

### Development

```
localhost:3000 (orchestrator)
localhost:3001 (research-agent)
localhost:3002 (analysis-agent)
localhost:3003 (writer-agent)
localhost:3100 (mcp-web-search)
```

### Production (Google Cloud Run)

```
https://orchestrator-xxx.run.app
  ↓
https://research-agent-xxx.run.app
https://analysis-agent-xxx.run.app
https://writer-agent-xxx.run.app
  ↓
https://mcp-web-search-xxx.run.app
```

Each service:
- Auto-scales based on load
- Has dedicated URL
- Runs in isolated container
- Uses managed SSL/TLS

## Trade-offs and Design Decisions

### 1. REST vs. gRPC

**Chosen**: REST with JSON
- Pro: Simple, widely understood, HTTP/2 support
- Pro: Easy debugging with curl
- Con: Larger payload size vs. protobuf

### 2. Monorepo vs. Polyrepo

**Chosen**: Monorepo with pnpm workspaces
- Pro: Shared code in core package
- Pro: Atomic changes across packages
- Con: Larger repository size

### 3. TypeScript Strict Mode

**Chosen**: Full strict mode
- Pro: Catch errors at compile time
- Pro: Better IDE support
- Con: More verbose code

### 4. Sequential vs. Parallel Workflows

**Chosen**: Sequential (for now)
- Pro: Simpler implementation
- Pro: Easier debugging
- Con: Slower execution

Future: Support both patterns

### 5. MCP vs. Direct Tool Integration

**Chosen**: MCP for external tools
- Pro: Standard protocol
- Pro: Tool server independence
- Con: Network overhead

## Future Enhancements

1. **Streaming Responses**: SSE from agents for real-time updates
2. **Conditional Workflows**: IF-THEN branching in orchestrator
3. **Human-in-the-Loop**: Approval steps in workflows
4. **Multi-Modal**: Support images, audio in workflows
5. **Long-Running Tasks**: Job queue for async workflows
6. **Agent Registry**: Dynamic agent discovery
7. **Workflow Templates**: Reusable workflow definitions

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Vertex AI Gemini API](https://cloud.google.com/vertex-ai/docs/generative-ai/model-reference/gemini)
- [Fastify Framework](https://www.fastify.io/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
