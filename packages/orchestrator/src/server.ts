import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { createLogger } from '@a2a/core';

import { ResearchClient, AnalysisClient, WriterClient } from './clients/index.js';
import { ResearchAnalysisWriterWorkflow } from './workflows/index.js';

const executeWorkflowSchema = z.object({
  query: z.string().min(1),
  context: z.record(z.unknown()).optional(),
  correlationId: z.string().uuid().optional(),
  workflow: z.enum(['research-analysis-writer']).optional().default('research-analysis-writer'),
});

type ExecuteWorkflowRequest = z.infer<typeof executeWorkflowSchema>;

async function main() {
  const PORT = parseInt(process.env.PORT ?? '3000', 10);
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
    name: 'orchestrator',
    level: process.env.LOG_LEVEL ?? 'info',
  });

  // Initialize agent clients
  const researchClient = new ResearchClient(
    process.env.RESEARCH_AGENT_URL ?? 'http://localhost:3001',
    logger,
    parseInt(process.env.AGENT_TIMEOUT ?? '30000', 10)
  );

  const analysisClient = new AnalysisClient(
    process.env.ANALYSIS_AGENT_URL ?? 'http://localhost:3002',
    logger,
    parseInt(process.env.AGENT_TIMEOUT ?? '30000', 10)
  );

  const writerClient = new WriterClient(
    process.env.WRITER_AGENT_URL ?? 'http://localhost:3003',
    logger,
    parseInt(process.env.AGENT_TIMEOUT ?? '30000', 10)
  );

  app.log.info('Agent clients initialized');

  // Initialize workflows
  const researchAnalysisWriterWorkflow = new ResearchAnalysisWriterWorkflow(
    researchClient,
    analysisClient,
    writerClient,
    logger
  );

  // Health check endpoint
  app.get('/health', async () => {
    const agentHealth = await Promise.all([
      researchClient.healthCheck(),
      analysisClient.healthCheck(),
      writerClient.healthCheck(),
    ]);

    const allHealthy = agentHealth.every((h) => h);

    return {
      status: allHealthy ? 'ok' : 'degraded',
      service: 'orchestrator',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      agents: {
        research: agentHealth[0] ? 'healthy' : 'unhealthy',
        analysis: agentHealth[1] ? 'healthy' : 'unhealthy',
        writer: agentHealth[2] ? 'healthy' : 'unhealthy',
      },
    };
  });

  // Execute workflow endpoint
  app.post<{ Body: ExecuteWorkflowRequest }>(
    '/api/v1/workflow/execute',
    async (request, reply) => {
      try {
        const input = executeWorkflowSchema.parse(request.body);

        app.log.info(
          {
            query: input.query,
            workflow: input.workflow,
          },
          'Executing workflow'
        );

        let result;

        switch (input.workflow) {
          case 'research-analysis-writer':
            result = await researchAnalysisWriterWorkflow.execute({
              query: input.query,
              context: input.context,
              correlationId: input.correlationId,
            });
            break;
          default:
            return reply.code(400).send({
              error: 'Bad Request',
              message: `Unknown workflow: ${input.workflow}`,
            });
        }

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

        app.log.error({ error }, 'Workflow execution failed');
        return reply.code(500).send({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }
  );

  // Start server
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🎭 Orchestrator running on http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   API: POST http://${HOST}:${PORT}/api/v1/workflow/execute`);
    console.log('');
    console.log('   Example request:');
    console.log('   curl -X POST http://localhost:3000/api/v1/workflow/execute \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"query": "Research quantum computing advances"}\'');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start Orchestrator:', error);
  process.exit(1);
});
