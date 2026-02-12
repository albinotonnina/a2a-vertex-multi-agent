import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Fastify from 'fastify';
import { z } from 'zod';

/**
 * Mock web search function.
 * In production, this would integrate with a real search API (DuckDuckGo, Brave Search, etc.).
 */
async function performWebSearch(query: string): Promise<string> {
  // Mock search results for learning/demonstration purposes
  const mockResults = {
    query,
    results: [
      {
        title: `Result 1 for: ${query}`,
        url: 'https://example.com/result1',
        snippet: `This is a mock search result for the query "${query}". In production, this would return real search results from a search API.`,
      },
      {
        title: `Result 2 for: ${query}`,
        url: 'https://example.com/result2',
        snippet: `Another relevant result about ${query}. The web search tool would integrate with services like DuckDuckGo or Brave Search.`,
      },
      {
        title: `Result 3 for: ${query}`,
        url: 'https://example.com/result3',
        snippet: `Additional information related to ${query}. This demonstrates how search results would be structured and returned.`,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(mockResults, null, 2);
}

/**
 * Create and configure the MCP server.
 */
function createMCPServer(): Server {
  const server = new Server(
    {
      name: 'web-search-server',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define the web_search tool
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'web_search',
          description:
            'Search the web for information. Returns a list of search results with titles, URLs, and snippets.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
              max_results: {
                type: 'number',
                description: 'Maximum number of results to return (default: 5)',
                default: 5,
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'web_search') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const argsSchema = z.object({
      query: z.string(),
      max_results: z.number().optional().default(5),
    });

    const args = argsSchema.parse(request.params.arguments);

    try {
      const results = await performWebSearch(args.query);

      return {
        content: [
          {
            type: 'text',
            text: results,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error performing web search: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main server setup with Fastify and SSE transport.
 */
async function main() {
  const PORT = parseInt(process.env.PORT ?? '3100', 10);
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

  // Create MCP server once at startup
  const mcpServer = createMCPServer();

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'mcp-web-search',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  // SSE endpoint for MCP
  app.get('/sse', async (_request, reply) => {
    const transport = new SSEServerTransport('/message', reply.raw);

    await mcpServer.connect(transport);

    app.log.info('MCP client connected via SSE');

    // Keep connection alive
    reply.raw.on('close', () => {
      app.log.info('MCP client disconnected');
    });
  });

  // Message endpoint for MCP
  app.post('/message', async (_request, reply) => {
    // SSE transport handles this
    return reply.code(200).send();
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🔍 MCP Web Search Server running on http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   SSE: http://${HOST}:${PORT}/sse`);
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
  console.error('Failed to start MCP Web Search Server:', error);
  process.exit(1);
});
