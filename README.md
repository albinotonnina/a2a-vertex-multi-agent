# Multi-Agent A2A System

A production-grade, distributed AI agent orchestration system built with TypeScript, Vertex AI Gemini, and Model Context Protocol (MCP). This system demonstrates modern agent architecture patterns through specialized agents that collaborate via REST APIs to accomplish complex tasks.

## Architecture

```
User Query
    ↓
Orchestrator (Port 3000)
    ↓
    ├─→ Research Agent (Port 3001) ──→ MCP Web Search (Port 3100)
    ├─→ Analysis Agent (Port 3002)
    └─→ Writer Agent (Port 3003)
    ↓
Final Response
```

### Components

- **Core Package** (`@a2a/core`): Shared abstractions including BaseAgent, GeminiClient, MCPClient, and utilities
- **Research Agent**: Gathers information using web search tools via MCP
- **Analysis Agent**: Interprets research findings and derives insights
- **Writer Agent**: Creates comprehensive reports from research and analysis
- **Orchestrator**: Coordinates multi-agent workflows with context passing
- **MCP Web Search Server**: Example MCP server providing web search capabilities

### Key Features

- **Agent Specialization**: Each agent has domain-specific capabilities and system prompts
- **Orchestrated Workflows**: Central orchestrator manages multi-step agent pipelines
- **Tool Integration**: MCP enables agents to use external tools (web search, data analysis)
- **Production Patterns**: REST APIs, observability (structured logging, correlation IDs), error handling, and cost tracking
- **Type Safety**: Full TypeScript with strict mode throughout
- **Monorepo**: pnpm workspaces for efficient dependency management

## Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Docker** and **Docker Compose** (for running full system)
- **Google Cloud Platform** account with:
  - Vertex AI API enabled
  - Service account with Vertex AI permissions
  - Service account key JSON file

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd A2A

# Run setup script
./scripts/setup.sh
```

### 2. Configure Environment

Edit `.env` with your GCP credentials:

```bash
# Required: Your GCP project ID
VERTEX_AI_PROJECT=your-project-id

# Required: Path to your service account key
GOOGLE_APPLICATION_CREDENTIALS_PATH=./credentials

# Optional: Model and location (defaults shown)
VERTEX_AI_LOCATION=us-central1
GEMINI_MODEL=gemini-1.5-pro
```

Add your GCP service account key to the `credentials` directory:

```bash
mkdir -p credentials
cp /path/to/your-key.json credentials/gcp-key.json
```

### 3. Start All Services

```bash
# Using docker-compose
./scripts/dev.sh

# Or manually
docker-compose up --build
```

This starts:
- MCP Web Search Server on port 3100
- Research Agent on port 3001
- Analysis Agent on port 3002
- Writer Agent on port 3003
- Orchestrator on port 3000

### 4. Test the System

```bash
# Execute a workflow
curl -X POST http://localhost:3000/api/v1/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Research and summarize the latest developments in quantum computing"
  }'

# Check orchestrator health
curl http://localhost:3000/health

# Check individual agent health
curl http://localhost:3001/health  # Research
curl http://localhost:3002/health  # Analysis
curl http://localhost:3003/health  # Writer
```

## Development

### Project Structure

```
A2A/
├── packages/
│   ├── core/                    # Shared utilities and abstractions
│   │   ├── src/
│   │   │   ├── agents/          # BaseAgent, types
│   │   │   ├── vertex/          # Gemini client, function calling
│   │   │   ├── mcp/             # MCP client
│   │   │   └── utils/           # Logger, cost tracker, retry
│   │   └── package.json
│   ├── research-agent/          # Research agent service
│   ├── analysis-agent/          # Analysis agent service
│   ├── writer-agent/            # Writer agent service
│   ├── orchestrator/            # Workflow orchestrator
│   └── mcp-servers/
│       └── web-search/          # MCP web search server
├── docker/
│   ├── Dockerfile.agent         # Dockerfile for agent services
│   ├── Dockerfile.orchestrator  # Dockerfile for orchestrator
│   └── Dockerfile.mcp           # Dockerfile for MCP servers
├── scripts/
│   ├── setup.sh                 # Setup script
│   ├── dev.sh                   # Development start script
│   └── test.sh                  # Test runner
├── docker-compose.yml           # Service orchestration
├── tsconfig.base.json           # Base TypeScript config
├── pnpm-workspace.yaml          # pnpm workspace config
└── README.md
```

### Building

```bash
# Build all packages
pnpm run build

# Build specific package
cd packages/core
pnpm run build

# Watch mode for development
pnpm run dev
```

### Running Tests

```bash
# Run all tests
pnpm run test

# Run with coverage
pnpm run test:ci

# Lint and typecheck
./scripts/test.sh
```

### Running Individual Services Locally

```bash
# Research Agent
cd packages/research-agent
pnpm run dev

# Analysis Agent
cd packages/analysis-agent
pnpm run dev

# Writer Agent
cd packages/writer-agent
pnpm run dev

# Orchestrator
cd packages/orchestrator
pnpm run dev

# MCP Web Search
cd packages/mcp-servers/web-search
pnpm run dev
```

## API Reference

### Orchestrator

#### POST /api/v1/workflow/execute

Execute a multi-agent workflow.

**Request:**

```json
{
  "query": "Research and analyze quantum computing advances",
  "context": {
    "focus_area": "quantum algorithms"
  },
  "correlationId": "optional-uuid",
  "workflow": "research-analysis-writer"
}
```

**Response:**

```json
{
  "correlationId": "abc-123",
  "result": "# Quantum Computing Advances\n\n...",
  "metadata": {
    "workflowName": "research-analysis-writer",
    "agents": [
      {
        "name": "research-agent",
        "executionTime": 5234,
        "tokenUsage": {
          "inputTokens": 1234,
          "outputTokens": 567,
          "totalTokens": 1801,
          "estimatedCost": 0.0023
        },
        "success": true
      }
    ],
    "totalExecutionTime": 15432,
    "totalTokenUsage": {
      "inputTokens": 3456,
      "outputTokens": 2345,
      "totalTokens": 5801,
      "estimatedCost": 0.0089
    },
    "totalCost": 0.0089
  },
  "intermediateResults": [
    {
      "agentName": "research-agent",
      "result": "..."
    }
  ]
}
```

### Individual Agents

Each agent exposes similar endpoints:

#### POST /api/v1/{agent}/process

- Research: `/api/v1/research/process`
- Analysis: `/api/v1/analysis/process`
- Writer: `/api/v1/writer/process`

**Request:**

```json
{
  "query": "Your query here",
  "correlationId": "optional-uuid",
  "context": {},
  "previousResults": [
    {
      "agentName": "previous-agent",
      "result": "..."
    }
  ]
}
```

## Cost Tracking

The system tracks token usage and estimates costs for all Gemini API calls:

```bash
# Get metrics from orchestrator
curl http://localhost:3000/metrics

# Get metrics from individual agent
curl http://localhost:3001/metrics
```

Pricing is configurable in `packages/core/src/utils/cost-tracker.ts`.

## Adding a New Agent

1. Create package structure:

```bash
mkdir -p packages/my-agent/src
cd packages/my-agent
```

2. Create `package.json` extending core:

```json
{
  "name": "@a2a/my-agent",
  "dependencies": {
    "@a2a/core": "workspace:*"
  }
}
```

3. Implement agent class:

```typescript
import { BaseAgent, type Tool } from '@a2a/core';

export class MyAgent extends BaseAgent {
  protected getSystemPrompt(): string {
    return 'Your agent system prompt...';
  }

  protected async registerTools(): Promise<Tool[]> {
    return []; // Your tools
  }

  public getName(): string {
    return 'my-agent';
  }
}
```

4. Create Fastify server (see existing agents for template)

5. Add to docker-compose.yml

See `docs/ADDING_AGENTS.md` for detailed guide.

## Creating MCP Tool Servers

MCP servers provide tools that agents can use. To create a new MCP server:

1. Create package in `packages/mcp-servers/`
2. Implement MCP server with tool definitions
3. Add to docker-compose.yml
4. Configure agent to connect to MCP server

See `docs/MCP_SERVERS.md` for detailed guide.

## Deployment

### Docker

```bash
# Build production images
docker-compose build

# Push to registry
docker tag a2a-orchestrator your-registry/a2a-orchestrator:latest
docker push your-registry/a2a-orchestrator:latest
```

### Google Cloud Run

Each service can be deployed independently to Cloud Run:

```bash
# Deploy orchestrator
gcloud run deploy a2a-orchestrator \
  --image your-registry/a2a-orchestrator:latest \
  --platform managed \
  --region us-central1 \
  --set-env-vars RESEARCH_AGENT_URL=https://research-agent-url
```

See `docs/DEPLOYMENT.md` for full deployment guide.

## Troubleshooting

### Common Issues

**"Failed to connect to MCP server"**
- Ensure MCP web search server is running
- Check `MCP_WEB_SEARCH_URL` environment variable

**"Vertex AI authentication failed"**
- Verify GCP service account has Vertex AI permissions
- Check `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Ensure Vertex AI API is enabled in your GCP project

**"Agent timeout"**
- Increase `AGENT_TIMEOUT` in environment variables
- Check network connectivity between services
- Monitor Gemini API quotas and limits

### Logs

All services use structured logging with correlation IDs:

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f orchestrator

# Search by correlation ID
docker-compose logs | grep "correlation-id-here"
```

## Performance Optimization

- Use `gemini-1.5-flash` for faster/cheaper responses (set `GEMINI_MODEL`)
- Implement response caching for repeated queries
- Run agents in parallel when possible (modify orchestrator workflows)
- Tune `GEMINI_TEMPERATURE` and `GEMINI_MAX_OUTPUT_TOKENS`

## License

MIT

## Contributing

Contributions welcome! Please read CONTRIBUTING.md first.

## Support

- Issues: GitHub Issues
- Documentation: `docs/` directory
- Examples: `examples/` directory
