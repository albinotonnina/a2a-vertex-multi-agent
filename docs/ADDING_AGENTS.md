# Adding New Agents to A2A

This guide walks through creating a new agent from scratch.

## Example: Creating a Code Generator Agent

We'll create an agent that generates code based on specifications.

## Step 1: Create Package Structure

```bash
# Create directory
mkdir -p packages/code-generator-agent/src

# Navigate to package
cd packages/code-generator-agent
```

## Step 2: Create package.json

```json
{
  "name": "@a2a/code-generator-agent",
  "version": "0.1.0",
  "description": "Agent for generating code from specifications",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "dev": "tsx src/server.ts",
    "start": "node dist/server.js",
    "clean": "rm -rf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@a2a/core": "workspace:*",
    "@fastify/cors": "^8.5.0",
    "@fastify/helmet": "^11.1.1",
    "fastify": "^4.25.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.16",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

## Step 3: Create TypeScript Config

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true,
    "tsBuildInfoFile": "./dist/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../core" }
  ]
}
```

## Step 4: Implement Agent Class

Create `src/agent.ts`:

```typescript
import { BaseAgent, type Tool } from '@a2a/core';

export class CodeGeneratorAgent extends BaseAgent {
  /**
   * Define the agent's specialized system prompt.
   */
  protected getSystemPrompt(): string {
    return `You are a code generation specialist.

Your responsibilities:
1. Generate clean, well-documented code from specifications
2. Follow language-specific best practices
3. Include error handling and edge cases
4. Provide explanatory comments
5. Suggest test cases

Guidelines:
- Ask for clarification if specifications are ambiguous
- Use modern language features appropriately
- Prioritize readability and maintainability
- Include type hints/annotations where applicable
- Follow SOLID principles

Output format:
- Brief summary of what the code does
- The code itself with comments
- Usage examples
- Suggested test cases
- Any assumptions or limitations`;
  }

  /**
   * Register tools specific to code generation.
   */
  protected async registerTools(): Promise<Tool[]> {
    return [
      {
        name: 'validate_syntax',
        description: 'Validate code syntax for a given language',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to validate',
            },
            language: {
              type: 'string',
              description: 'Programming language (e.g., javascript, python, typescript)',
            },
          },
          required: ['code', 'language'],
        },
        execute: async (params) => {
          // In production, use actual linters/parsers
          // This is a simplified example
          const code = params.code as string;
          const language = params.language as string;

          // Mock validation
          const hasBasicStructure = code.length > 10;
          const hasBraces = language === 'javascript' || language === 'typescript'
            ? code.includes('{') && code.includes('}')
            : true;

          return {
            valid: hasBasicStructure && hasBraces,
            language,
            message: hasBasicStructure && hasBraces
              ? 'Code structure appears valid'
              : 'Code structure may have issues',
          };
        },
      },
      {
        name: 'suggest_tests',
        description: 'Suggest test cases for code',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'The code to generate tests for',
            },
            framework: {
              type: 'string',
              description: 'Testing framework (e.g., jest, pytest)',
            },
          },
          required: ['code'],
        },
        execute: async (params) => {
          const code = params.code as string;

          // Extract function names (simplified)
          const functionMatches = code.match(/(?:function|def|const)\s+(\w+)/g) ?? [];
          const functions = functionMatches.map(m => m.split(/\s+/)[1]);

          return {
            suggested_tests: functions.map(fn => ({
              function: fn,
              tests: [
                `test_${fn}_with_valid_input`,
                `test_${fn}_with_invalid_input`,
                `test_${fn}_edge_cases`,
              ],
            })),
          };
        },
      },
    ];
  }

  /**
   * Agent identifier.
   */
  public getName(): string {
    return 'code-generator-agent';
  }
}
```

## Step 5: Create Fastify Server

Create `src/server.ts`:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { createLogger } from '@a2a/core';

import { CodeGeneratorAgent } from './agent.js';

const processRequestSchema = z.object({
  correlationId: z.string().uuid().optional(),
  query: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  previousResults: z
    .array(
      z.object({
        agentName: z.string(),
        result: z.unknown(),
      })
    )
    .optional(),
});

type ProcessRequest = z.infer<typeof processRequestSchema>;

async function main() {
  const PORT = parseInt(process.env.PORT ?? '3004', 10);
  const HOST = process.env.HOST ?? '0.0.0.0';

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'SYS:standard',
              },
            }
          : undefined,
    },
  });

  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });

  const logger = createLogger({
    name: 'code-generator-agent',
    level: process.env.LOG_LEVEL ?? 'info',
  });

  const agent = new CodeGeneratorAgent(
    {
      projectId: process.env.VERTEX_AI_PROJECT ?? '',
      location: process.env.VERTEX_AI_LOCATION ?? 'us-central1',
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE ?? '0.2'), // Lower for code
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? '8192', 10),
    },
    logger
  );

  await agent.initialize();
  app.log.info('Code Generator agent initialized successfully');

  app.get('/health', async () => ({
    status: 'ok',
    agent: 'code-generator-agent',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  }));

  app.get('/metrics', async () => ({
    agent: 'code-generator-agent',
    metrics: agent.getMetrics(),
    timestamp: new Date().toISOString(),
  }));

  app.post<{ Body: ProcessRequest }>(
    '/api/v1/code-generator/process',
    async (request, reply) => {
      try {
        const input = processRequestSchema.parse(request.body);
        app.log.info({ query: input.query }, 'Processing code generation request');

        const result = await agent.processRequest(input);
        return reply.code(200).send(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          app.log.warn({ errors: error.errors }, 'Invalid request');
          return reply.code(400).send({
            error: 'Bad Request',
            message: 'Invalid request format',
            details: error.errors,
          });
        }

        app.log.error({ error }, 'Request processing failed');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }
  );

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`💻 Code Generator Agent running on http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   Metrics: http://${HOST}:${PORT}/metrics`);
    console.log(`   API: POST http://${HOST}:${PORT}/api/v1/code-generator/process`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await agent.shutdown();
      await app.close();
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start Code Generator Agent:', error);
  process.exit(1);
});
```

Create `src/index.ts`:

```typescript
export * from './agent.js';
```

## Step 6: Update Root Configuration

### Update tsconfig.json

Add reference to new package:

```json
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/research-agent" },
    { "path": "./packages/analysis-agent" },
    { "path": "./packages/writer-agent" },
    { "path": "./packages/code-generator-agent" },  // Add this
    { "path": "./packages/orchestrator" },
    { "path": "./packages/mcp-servers/web-search" }
  ]
}
```

## Step 7: Add to Docker Compose

Update `docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  code-generator-agent:
    build:
      context: .
      dockerfile: docker/Dockerfile.agent
    container_name: a2a-code-generator-agent
    command: ["node", "packages/code-generator-agent/dist/server.js"]
    ports:
      - "3004:3004"
    environment:
      - NODE_ENV=production
      - PORT=3004
      - HOST=0.0.0.0
      - LOG_LEVEL=info
      - VERTEX_AI_PROJECT=${VERTEX_AI_PROJECT}
      - VERTEX_AI_LOCATION=${VERTEX_AI_LOCATION:-us-central1}
      - GEMINI_MODEL=${GEMINI_MODEL:-gemini-1.5-pro}
      - GEMINI_TEMPERATURE=0.2  # Lower for code generation
      - GEMINI_MAX_OUTPUT_TOKENS=${GEMINI_MAX_OUTPUT_TOKENS:-8192}
      - GOOGLE_APPLICATION_CREDENTIALS=/app/credentials/gcp-key.json
    volumes:
      - ${GOOGLE_APPLICATION_CREDENTIALS_PATH:-./credentials}:/app/credentials:ro
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3004/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - a2a-network
```

## Step 8: Update Dockerfile

Update `docker/Dockerfile.agent` to include the new package:

```dockerfile
# In the deps stage
COPY packages/code-generator-agent/package.json ./packages/code-generator-agent/

# In the builder stage
COPY packages/code-generator-agent ./packages/code-generator-agent

# In the runner stage
COPY --from=builder /app/packages/code-generator-agent/dist ./packages/code-generator-agent/dist
COPY --from=builder /app/packages/code-generator-agent/package.json ./packages/code-generator-agent/
```

## Step 9: Build and Test

```bash
# Install dependencies
pnpm install

# Build the package
cd packages/code-generator-agent
pnpm run build

# Test locally
pnpm run dev

# In another terminal, test the endpoint
curl -X POST http://localhost:3004/api/v1/code-generator/process \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate a TypeScript function to calculate fibonacci numbers with memoization"
  }'
```

## Step 10: Integrate with Orchestrator (Optional)

Create a new workflow or update existing one:

```typescript
// packages/orchestrator/src/workflows/research-code-workflow.ts
export class ResearchCodeWorkflow {
  async execute(input: WorkflowInput): Promise<WorkflowOutput> {
    // 1. Research the topic/technology
    const research = await this.researchClient.process({
      query: input.query,
      correlationId: input.correlationId,
    });

    // 2. Generate code based on research
    const code = await this.codeGeneratorClient.process({
      query: `Based on this research, generate code: ${input.query}`,
      previousResults: [
        { agentName: 'research-agent', result: research.result }
      ],
      correlationId: input.correlationId,
    });

    return { ...code };
  }
}
```

## Step 11: Deploy

```bash
# Build with docker-compose
docker-compose build code-generator-agent

# Start all services
docker-compose up

# Or deploy to Cloud Run
gcloud run deploy code-generator-agent \
  --image gcr.io/project-id/code-generator-agent:latest \
  --platform managed \
  --region us-central1
```

## Best Practices

### 1. System Prompts

- Be specific about the agent's role and capabilities
- Include output format guidelines
- Specify quality criteria
- Add safety/ethical guidelines if needed

### 2. Tools

- Create focused, single-purpose tools
- Validate input parameters
- Handle errors gracefully
- Return structured data

### 3. Temperature Settings

- Lower (0.2-0.4) for deterministic tasks (code, data)
- Medium (0.5-0.7) for balanced creativity
- Higher (0.8-1.0) for creative writing

### 4. Testing

```typescript
// packages/code-generator-agent/src/agent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeGeneratorAgent } from './agent.js';

describe('CodeGeneratorAgent', () => {
  let agent: CodeGeneratorAgent;

  beforeEach(async () => {
    agent = new CodeGeneratorAgent({...}, logger);
    await agent.initialize();
  });

  it('should register code generation tools', async () => {
    const tools = await agent.registerTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]?.name).toBe('validate_syntax');
  });

  it('should generate code from specification', async () => {
    const result = await agent.processRequest({
      query: 'Create a function to reverse a string',
    });

    expect(result.result).toBeDefined();
    expect(typeof result.result).toBe('string');
  });
});
```

### 5. Documentation

Create `packages/code-generator-agent/README.md`:

```markdown
# Code Generator Agent

Agent specialized in generating code from specifications.

## Features

- Multi-language code generation
- Syntax validation
- Test case suggestions
- Best practices adherence

## API

### POST /api/v1/code-generator/process

Generate code from specification.

**Example:**

\`\`\`bash
curl -X POST http://localhost:3004/api/v1/code-generator/process \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Generate a Python function to merge two sorted lists"
  }'
\`\`\`

## Configuration

- `GEMINI_TEMPERATURE`: 0.2 (recommended for code generation)
- `PORT`: 3004

## Tools

- `validate_syntax`: Check code syntax
- `suggest_tests`: Generate test cases
```

## Summary

To add a new agent:

1. ✅ Create package structure
2. ✅ Implement agent class (extend BaseAgent)
3. ✅ Create Fastify server
4. ✅ Add to tsconfig references
5. ✅ Update Docker configuration
6. ✅ Build and test locally
7. ✅ (Optional) Integrate with orchestrator
8. ✅ Deploy

The BaseAgent handles all the complexity of:
- Gemini integration
- Function calling
- Cost tracking
- Logging and correlation IDs
- Error handling

You only need to focus on:
- System prompt (agent's personality and capabilities)
- Tools (specific functionality)
- Agent name and endpoint path
