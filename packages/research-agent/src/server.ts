import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { z } from 'zod';
import { createLogger } from '@a2a/core';

import { ResearchAgent } from './agent.js';

/**
 * Request schema for agent processing.
 */
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

/**
 * Main server setup.
 */
async function main() {
  const PORT = parseInt(process.env.PORT ?? '3001', 10);
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

  // Register plugins
  await app.register(cors, {
    origin: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Initialize logger
  const logger = createLogger({
    name: 'research-agent',
    level: process.env.LOG_LEVEL ?? 'info',
  });

  // Initialize agent
  const agent = new ResearchAgent(
    {
      projectId: process.env.VERTEX_AI_PROJECT ?? '',
      location: process.env.VERTEX_AI_LOCATION ?? 'us-central1',
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-pro',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE ?? '0.7'),
      maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? '8192', 10),
    },
    logger
    // Temporarily disable MCP to get the system working
    // TODO: Fix MCP SSE transport compatibility
    // process.env.MCP_WEB_SEARCH_URL
    //   ? {
    //       url: process.env.MCP_WEB_SEARCH_URL,
    //       timeout: 30000,
    //     }
    //   : undefined
  );

  await agent.initialize();

  app.log.info('Research agent initialized successfully');

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      agent: 'research-agent',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  // Metrics endpoint
  app.get('/metrics', async () => {
    const metrics = agent.getMetrics();
    return {
      agent: 'research-agent',
      metrics,
      timestamp: new Date().toISOString(),
    };
  });

  // Process request endpoint
  app.post<{ Body: ProcessRequest }>('/api/v1/research/process', async (request, reply) => {
    try {
      const input = processRequestSchema.parse(request.body);

      app.log.info({ query: input.query }, 'Processing research request');

      const result = await agent.processRequest(input as any);

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
  });

  // Start server
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🔬 Research Agent running on http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   Metrics: http://${HOST}:${PORT}/metrics`);
    console.log(`   API: POST http://${HOST}:${PORT}/api/v1/research/process`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
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
  console.error('Failed to start Research Agent:', error);
  process.exit(1);
});
