# Getting Started with A2A

This guide will walk you through setting up and running the A2A Multi-Agent System for the first time.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 20+** installed
2. **pnpm** package manager (`npm install -g pnpm`)
3. **Docker and Docker Compose** installed
4. **Google Cloud Platform** account

## Step 1: GCP Setup

### 1.1 Create a GCP Project

```bash
# Create new project
gcloud projects create a2a-demo --name="A2A Demo"

# Set as current project
gcloud config set project a2a-demo
```

### 1.2 Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com
```

### 1.3 Create Service Account

```bash
# Create service account
gcloud iam service-accounts create a2a-agent \
  --display-name="A2A Agent Service Account"

# Grant Vertex AI permissions
gcloud projects add-iam-policy-binding a2a-demo \
  --member="serviceAccount:a2a-agent@a2a-demo.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create credentials/gcp-key.json \
  --iam-account=a2a-agent@a2a-demo.iam.gserviceaccount.com
```

## Step 2: Project Setup

### 2.1 Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd A2A

# Run setup script
./scripts/setup.sh
```

The setup script will:
- Install pnpm (if not already installed)
- Install all dependencies
- Build all packages
- Create `.env` from template
- Create `credentials` directory

### 2.2 Configure Environment

Edit `.env` with your project details:

```bash
# .env
VERTEX_AI_PROJECT=a2a-demo
VERTEX_AI_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS_PATH=./credentials
GEMINI_MODEL=gemini-1.5-pro
```

### 2.3 Add Credentials

Place your service account key in the credentials directory:

```bash
cp /path/to/downloaded-key.json credentials/gcp-key.json
```

## Step 3: Start the System

### Option A: Using Docker Compose (Recommended)

```bash
./scripts/dev.sh
```

This starts all services. Wait for all health checks to pass (look for "healthy" status).

### Option B: Manual Start (for development)

In separate terminals:

```bash
# Terminal 1: MCP Web Search
cd packages/mcp-servers/web-search
pnpm run dev

# Terminal 2: Research Agent
cd packages/research-agent
pnpm run dev

# Terminal 3: Analysis Agent
cd packages/analysis-agent
pnpm run dev

# Terminal 4: Writer Agent
cd packages/writer-agent
pnpm run dev

# Terminal 5: Orchestrator
cd packages/orchestrator
pnpm run dev
```

## Step 4: Test the System

### 4.1 Health Check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "orchestrator",
  "agents": {
    "research": "healthy",
    "analysis": "healthy",
    "writer": "healthy"
  }
}
```

### 4.2 Execute a Simple Workflow

```bash
curl -X POST http://localhost:3000/api/v1/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is quantum computing?"
  }'
```

### 4.3 Execute a Complex Workflow

```bash
curl -X POST http://localhost:3000/api/v1/workflow/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Research recent breakthroughs in quantum computing, analyze their significance, and write a comprehensive report",
    "context": {
      "target_audience": "technical professionals",
      "report_length": "comprehensive"
    }
  }' | jq
```

## Step 5: Explore the Results

The response will include:

- **correlationId**: Trace this through logs
- **result**: Final report from Writer Agent
- **metadata**: Execution metrics, token usage, costs
- **intermediateResults**: Outputs from Research and Analysis agents

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f research-agent

# Search by correlation ID
docker-compose logs | grep "<correlation-id>"
```

### Check Metrics

```bash
# Orchestrator metrics
curl http://localhost:3000/metrics

# Individual agent metrics
curl http://localhost:3001/metrics  # Research
curl http://localhost:3002/metrics  # Analysis
curl http://localhost:3003/metrics  # Writer
```

## Next Steps

- **Customize Agents**: Modify system prompts in agent classes
- **Add Tools**: Create new MCP servers or local tools
- **Create Workflows**: Implement new orchestration patterns
- **Optimize Costs**: Switch to `gemini-1.5-flash` for cheaper operations
- **Deploy**: Deploy to Cloud Run or other container platforms

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
```

### Docker Build Fails

```bash
# Clean Docker cache
docker-compose down -v
docker system prune -a

# Rebuild
docker-compose up --build
```

### Authentication Errors

1. Verify service account key is in `credentials/` directory
2. Check `VERTEX_AI_PROJECT` matches your GCP project
3. Ensure Vertex AI API is enabled
4. Verify service account has `roles/aiplatform.user`

### MCP Connection Errors

1. Ensure MCP web search server is running (port 3100)
2. Check `MCP_WEB_SEARCH_URL` in agent environment
3. Verify network connectivity between containers

## Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Adding Agents Guide](./ADDING_AGENTS.md)
- [MCP Servers Guide](./MCP_SERVERS.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Reference](../README.md#api-reference)
