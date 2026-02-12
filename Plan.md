 Multi-Agent A2A System Implementation Plan

 Context

 This plan outlines the implementation of a multi-agent Agent-to-Agent (A2A) system where specialized AI agents communicate via REST APIs to accomplish complex tasks collaboratively. The system demonstrates modern agent
 architecture patterns:

- Agent Specialization: Research, Analysis, and Writer agents, each with domain-specific capabilities
- Orchestrated Workflows: A central orchestrator coordinates multi-agent pipelines
- Tool Integration: Model Context Protocol (MCP) enables agents to use external tools (web search, data analysis)
- Production Patterns: REST APIs, observability, error handling, and cost tracking

 The goal is to create a learning-oriented but production-grade implementation showcasing how to build distributed AI agent systems using TypeScript, Vertex AI Gemini, and MCP.

 Architecture Overview

 User Query
     ↓
 Orchestrator (Port 3000)
     ↓
     ├─→ Research Agent (Port 3001) ──→ MCP Web Search (Port 3100)
     ├─→ Analysis Agent (Port 3002)
     └─→ Writer Agent (Port 3003)
     ↓
 Final Response

 Key Components:

- Core Package (@a2a/core): Shared abstractions (BaseAgent, GeminiClient, MCPClient, utilities)
- Agent Packages: Specialized agents extending BaseAgent, each wrapped as Fastify REST server
- Orchestrator: Coordinates multi-agent workflows with context passing
- MCP Servers: Tool servers (web search) that agents connect to
- Development Environment: Docker Compose orchestrating all services

 Implementation Plan

 Phase 1: Foundation & Monorepo Setup

 Objective: Create the monorepo infrastructure with TypeScript, linting, and dependency management.

 1. Initialize Monorepo

- Create root package.json with pnpm workspaces configuration
- Create pnpm-workspace.yaml defining workspace packages
- Create .npmrc for workspace protocol configuration
- Create .gitignore for Node.js/TypeScript projects

 1. TypeScript Configuration

- Create tsconfig.base.json with strict mode, ES2022 target, bundler module resolution
- Configure project references for incremental builds
- Create per-package tsconfig.json extending base config

 1. Code Quality Tools

- Create .eslintrc.json with TypeScript rules
- Create .prettierrc for code formatting
- Add lint/format scripts to root package.json

 1. Vitest Configuration

- Create vitest.config.ts with coverage settings
- Configure test timeouts for integration tests (30s)

 Phase 2: Core Package Foundation

 Objective: Build shared utilities and abstractions that all agents will use.

 1. Core Package Structure

- Create packages/core/package.json with dependencies:
  - @google-cloud/vertexai (Vertex AI client)
  - @modelcontextprotocol/sdk (MCP SDK)
  - zod (validation), pino (logging), p-retry (retry logic)
- Set up directory structure: src/agents/, src/vertex/, src/mcp/, src/utils/

 1. Utilities Implementation

- Logger (src/utils/logger.ts): Pino-based structured logger with correlation ID support
- Correlation ID (src/utils/correlation.ts): UUID generation and middleware for tracking requests
- Cost Tracker (src/utils/cost-tracker.ts): Track token usage and estimate costs per request
- Retry Utility (src/utils/retry.ts): Wrapper around p-retry with exponential backoff

 1. Vertex AI Gemini Client

- GeminiClient (src/vertex/gemini-client.ts):
  - Initialize Vertex AI client with project ID and location
  - Wrap generateContent with retry logic
  - Track token usage for cost calculation
  - Support function calling declarations
- Function Calling Handler (src/vertex/function-calling.ts):
  - Parse function call requests from Gemini responses
  - Execute function calls and format results for Gemini
  - Implement iterative loop until final answer (handle multi-turn function calling)

 1. MCP Client

- MCPClient (src/mcp/mcp-client.ts):
  - Connect to MCP server via HTTP/SSE transport
  - Implement listTools() to discover available tools
  - Implement callTool(name, args) to invoke tools
  - Handle connection lifecycle (connect, disconnect, error handling)
- MCP Types (src/mcp/types.ts): Tool schemas, request/response types

 Phase 3: BaseAgent Abstraction

 Objective: Create the abstract base class that standardizes agent behavior.

 1. BaseAgent Implementation (src/agents/base-agent.ts)

- Abstract Class with:
  - geminiClient: GeminiClient - LLM client
  - mcpClient: MCPClient | null - Optional MCP client for tools
  - logger: Logger - Child logger with agent name
  - costTracker: CostTracker - Token usage tracking
- Abstract Methods:
  - getSystemPrompt(): string - Agent-specific system prompt
  - registerTools(): Promise<Tool[]> - Define available tools
  - getName(): string - Agent identifier
- Common Methods:
  - async processRequest(input: AgentInput): Promise<AgentOutput>:
           1. Generate correlation ID if not provided
       1. Log request with correlation ID
       2. Build Gemini prompt with system prompt + user query + context
       3. Execute function calling loop with registered tools
       4. Track token usage and costs
       5. Return structured result with metadata
  - protected async executeFunctionCalling(messages): Implement iterative function calling loop
  - protected async invokeTool(name, params): Invoke registered tool (MCP or local)

 1. Agent Types (src/agents/types.ts)

- AgentInput: { correlationId?, query, context?, previousResults? }
- AgentOutput: { correlationId, result, metadata: { agentName, executionTime, tokenUsage, toolsUsed } }
- TokenUsage: { inputTokens, outputTokens, totalTokens, estimatedCost }

 Phase 4: MCP Web Search Server

 Objective: Create example MCP server for web search tool.

 1. Web Search MCP Server (packages/mcp-servers/web-search)

- Create package with @modelcontextprotocol/sdk dependency
- Server Implementation (src/server.ts):
  - Initialize MCP server with HTTP/SSE transport
  - Handle tools/list: Return web_search tool definition with JSON schema
  - Handle tools/call: Execute web search (use free API like DuckDuckGo or mock results for learning)
  - Return results as MCP content blocks
- Dockerfile: Containerize for docker-compose
- Add health check endpoint

 Phase 5: Research Agent

 Objective: Build first specialized agent with MCP tool integration.

 1. Research Agent Package (packages/research-agent)

- Extend BaseAgent:
  - getSystemPrompt(): "You are a research assistant. Use web search to find accurate, up-to-date information..."
  - registerTools(): Connect to MCP web search server, list tools, return to Gemini
  - getName(): "research-agent"
- Agent Class (src/agent.ts): Extend BaseAgent with research-specific logic

 1. Fastify REST Server (src/server.ts)

- Initialize Fastify with plugins: @fastify/cors, @fastify/helmet, logging
- POST /api/v1/research/process:
  - Request schema: { correlationId?, query, context? } (Zod validation)
  - Call researchAgent.processRequest(input)
  - Return AgentOutput with 200 status
  - Error handling with appropriate status codes
- GET /health: Return { status: "ok", agent: "research-agent", version }
- GET /metrics: Return cost tracker metrics
- Listen on PORT env variable (default 3001)

 1. Testing

- Unit tests: Mock GeminiClient and MCPClient, test agent logic
- Integration tests: Test with real Vertex AI (test project), mocked MCP server

 Phase 6: Analysis and Writer Agents

 Objective: Implement remaining specialized agents following the same pattern.

 1. Analysis Agent (packages/analysis-agent)

- Extend BaseAgent with analysis-specific system prompt
- Tools: Data parsing, statistics (can be MCP or local functions)
- Fastify server on port 3002 with same endpoint structure
- Tests

 1. Writer Agent (packages/writer-agent)

- Extend BaseAgent with content writing system prompt
- Tools: Formatting utilities (markdown, HTML - can be local functions)
- Fastify server on port 3003
- Tests

 Phase 7: Orchestrator

 Objective: Build workflow coordination layer.

 1. Agent HTTP Clients (packages/orchestrator/src/clients/)

- ResearchClient (research-client.ts):
  - HTTP client using undici or fetch
  - async process(input): Promise<AgentOutput>
  - Wrap with p-retry (max 3 retries, exponential backoff)
  - Timeout configuration (30s)
- AnalysisClient (analysis-client.ts): Same pattern
- WriterClient (writer-client.ts): Same pattern

 1. Workflow Implementation (src/workflows/research-analysis-writer.ts)

- Class: ResearchAnalysisWriterWorkflow
- Method: async execute(input: WorkflowInput): Promise<WorkflowOutput>
       i. Generate correlation ID
     ii. Call Research Agent with query
     iii. Call Analysis Agent with query + research results in context
     iv. Call Writer Agent with query + research + analysis results in context
     v. Aggregate token usage and costs from all agents
     vi. Return final result with metadata (execution time, costs, intermediate results)
- Error Handling:
  - Try-catch around each agent call
  - On failure: log error, optionally return partial results or fail gracefully
  - Configurable behavior: fail-fast vs. continue-on-error

 1. Orchestrator API (src/server.ts)

- POST /api/v1/workflow/execute:
  - Request: { query, workflow?: "research-analysis-writer" }
  - Create workflow instance
  - Execute workflow
  - Return { correlationId, result, metadata: { agents, totalCost, executionTime } }
- GET /health: Health check
- GET /metrics: Aggregate metrics
- Listen on port 3000

 Phase 8: Development Environment

 Objective: Enable local development with all services running.

 1. Docker Configuration

- Dockerfile.agent (docker/Dockerfile.agent):
  - Multi-stage build: install deps → build → run
  - Node 20+ base image
  - Support running any agent package via command override
- Dockerfile.orchestrator (docker/Dockerfile.orchestrator): Similar but for orchestrator
- docker-compose.yml (docker/docker-compose.yml):
  - Services: mcp-web-search, research-agent, analysis-agent, writer-agent, orchestrator
  - Port mappings: 3000, 3001, 3002, 3003, 3100
  - Environment variables from .env file
  - Volume mounts for development (hot reload)
  - Service dependencies (orchestrator depends on agents, agents depend on MCP servers)

 1. Environment Configuration

- .env.example: Template with all required variables
  - VERTEX_AI_PROJECT, VERTEX_AI_LOCATION, GOOGLE_APPLICATION_CREDENTIALS
  - Agent URLs, ports
  - Log level, Gemini model config
- Documentation: How to set up GCP service account and credentials

 1. Development Scripts (scripts/)

- setup.sh: Install pnpm, run pnpm install, build all packages
- dev.sh: Start docker-compose in development mode
- test.sh: Run all test suites sequentially
- Make scripts executable: chmod +x scripts/*.sh

 Phase 9: Testing

 Objective: Comprehensive test coverage.

 1. Unit Tests

- Core utilities: Logger, CostTracker, CorrelationID (mock-free)
- GeminiClient: Mock Vertex AI responses
- MCPClient: Mock MCP server responses
- BaseAgent: Mock clients, test process flow
- Agent-specific logic: Mock dependencies

 1. Integration Tests

- Agent + Gemini: Real API calls with test project (small budget)
- Agent + MCP: Real MCP server integration
- Fastify routes: Test HTTP layer with supertest-like tool

 1. E2E Tests (packages/orchestrator/tests/e2e/)

- Spin up docker-compose with test configuration
- Send request to orchestrator endpoint
- Verify:
  - Workflow completes successfully
  - Correlation ID propagates through all agents
  - Final result contains expected structure
  - Cost tracking aggregates correctly
- Teardown docker-compose after tests

 Phase 10: Documentation

 Objective: Comprehensive documentation for learning and usage.

 1. Root README (README.md)

- Architecture diagram (ASCII or link to image)
- Quick start guide
- Prerequisites (Node 20+, pnpm, Docker, GCP account)
- Setup instructions
- Development workflow
- Testing guide
- Deployment guide (Docker, Cloud Run suggestions)

 1. Package READMEs

- Each package: Purpose, API reference, examples
- packages/core: How to extend BaseAgent
- Agent packages: Endpoints, example requests/responses
- Orchestrator: Workflow documentation

 1. Architecture Documentation

- Design decisions and trade-offs
- How to add a new agent (step-by-step)
- How to create a new MCP tool server
- Cost optimization tips

 Critical Files

 These are the foundational files that must be implemented for the system to work:

 1. packages/core/src/agents/base-agent.ts

- Core abstraction for all agents
- Integrates Gemini + MCP + observability
- ~300 lines, high complexity

 1. packages/core/src/vertex/gemini-client.ts

- Vertex AI Gemini integration
- Function calling support
- ~200 lines

 1. packages/core/src/mcp/mcp-client.ts

- MCP SDK client wrapper
- Tool discovery and invocation
- ~150 lines

 1. packages/research-agent/src/agent.ts & src/server.ts

- First concrete agent implementation
- Demonstrates BaseAgent extension pattern
- REST API wrapper
- ~200 lines combined

 1. packages/orchestrator/src/workflows/research-analysis-writer.ts

- Multi-agent workflow orchestration
- Context passing between agents
- ~150 lines

 1. docker/docker-compose.yml

- Orchestrates all services for local development
- Critical for testing full system
- ~100 lines

 1. packages/mcp-servers/web-search/src/server.ts

- Example MCP server implementation
- Tool registration and execution
- ~100 lines

 1. tsconfig.base.json & package.json (root)

- Monorepo configuration
- Workspace setup
- ~100 lines combined

 Implementation Sequence

 Week 1: Phases 1-3 (Foundation, Core Package, BaseAgent)
 Week 2: Phases 4-5 (MCP Server, Research Agent)
 Week 3: Phases 6-7 (Analysis/Writer Agents, Orchestrator)
 Week 4: Phases 8-9 (Docker, Testing)
 Week 5: Phase 10 (Documentation, Polish)

 Critical Path: Core package → BaseAgent → Research Agent → Orchestrator → Docker setup

 Verification Plan

 After implementation, verify the system works end-to-end:

 1. Individual Agent Testing

# Start MCP web search server

 docker-compose up mcp-web-search

# Start research agent

 docker-compose up research-agent

# Test research agent directly

 curl -X POST <http://localhost:3001/api/v1/research/process> \
   -H "Content-Type: application/json" \
   -d '{"query": "What are the latest developments in quantum computing?"}'

# Verify response contains

# - correlationId

# - result with research findings

# - metadata with tokenUsage, executionTime

 1. Full Workflow Testing

# Start all services

 docker-compose up

# Wait for services to be healthy

 ./scripts/wait-for-services.sh

# Test full workflow

 curl -X POST <http://localhost:3000/api/v1/workflow/execute> \
   -H "Content-Type: application/json" \
   -d '{"query": "Research and summarize the current state of quantum computing"}'

# Verify response contains

# - Final written summary

# - Intermediate results from research and analysis

# - Aggregated metadata (total cost, execution time)

# - Same correlationId throughout

 1. Correlation ID Tracing

# Check logs from all services

 docker-compose logs | grep "correlation-id-from-above"

# Verify correlation ID appears in logs from

# - orchestrator (workflow start)

# - research-agent (research phase)

# - analysis-agent (analysis phase)

# - writer-agent (writing phase)

 1. Cost Tracking

# Get metrics from orchestrator

 curl <http://localhost:3000/metrics>

# Verify metrics show

# - Total requests processed

# - Total tokens consumed

# - Estimated costs (sum of all agent costs)

 1. Test Suite

# Run all tests

 pnpm test

# Verify

# - Unit tests pass (core, agents, utils)

# - Integration tests pass (agent+Gemini, agent+MCP)

# - E2E tests pass (full workflow)

# - Coverage >80%

 1. Error Handling

# Test with invalid input

 curl -X POST <http://localhost:3000/api/v1/workflow/execute> \
   -H "Content-Type: application/json" \
   -d '{"invalid": "data"}'

# Verify: 400 Bad Request with validation error

# Stop one agent to test resilience

 docker-compose stop analysis-agent

# Send request

 curl -X POST <http://localhost:3000/api/v1/workflow/execute> \
   -H "Content-Type: application/json" \
   -d '{"query": "Test query"}'

# Verify: Graceful error or partial results (depending on config)

 Success Criteria

- ✅ All services start successfully with docker-compose up
- ✅ Individual agents respond to API requests
- ✅ Full workflow executes from orchestrator to final result
- ✅ Correlation IDs propagate through all agents
- ✅ Token usage and costs are tracked accurately
- ✅ All test suites pass with >80% coverage
- ✅ Documentation is comprehensive and clear
- ✅ Code follows TypeScript strict mode with no errors

 Next Steps After Implementation

 1. Enhancements:

- Add authentication (API keys, JWT)
- Implement streaming responses (SSE from agents)
- Add response caching
- Add rate limiting

 1. Deployment:

- Deploy to Cloud Run (container-based)
- Set up CI/CD with GitHub Actions
- Configure production monitoring (Prometheus, Grafana)

 1. Additional Agents:

- Code Generator Agent
- Data Visualization Agent
- Email/Communication Agent

 1. Advanced Workflows:

- Parallel agent execution
- Conditional branching (if-then workflows)
- Human-in-the-loop approval steps
