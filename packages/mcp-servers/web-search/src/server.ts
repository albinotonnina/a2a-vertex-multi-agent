import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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
 * Main server setup with Fastify and Streamable HTTP transport.
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

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'mcp-web-search',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  // Store active transports by session ID
  const sessions = new Map<string, { server: Server; transport: StreamableHTTPServerTransport }>();

  /**
   * Handle all MCP requests (POST and GET) on a single /mcp endpoint.
   * The StreamableHTTPServerTransport routes initialization, messages, and SSE streams internally.
   */
  app.post('/mcp', async (request, reply) => {
    // Check for existing session
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (session) {
      // Existing session — forward request
      await session.transport.handleRequest(request.raw, reply.raw, request.body);
      return reply.hijack();
    }

    // Reject non-init requests with unknown session
    if (sessionId) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    // New session (no session header) — create transport and MCP server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    const mcpServer = createMCPServer();
    await mcpServer.connect(transport);

    // Process the initial request (initialize handshake) — this generates the session ID
    await transport.handleRequest(request.raw, reply.raw, request.body);

    // Store session now that the transport has a session ID
    const newSessionId = transport.sessionId;
    if (newSessionId) {
      sessions.set(newSessionId, { server: mcpServer, transport });
      app.log.info({ sessionId: newSessionId }, 'New MCP session created');

      transport.onclose = () => {
        sessions.delete(newSessionId);
        app.log.info({ sessionId: newSessionId }, 'MCP session closed');
      };
    }

    return reply.hijack();
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions.has(sessionId)) {
      return reply.code(400).send({ error: 'Invalid or missing session ID' });
    }

    const session = sessions.get(sessionId)!;
    await session.transport.handleRequest(request.raw, reply.raw);
    return reply.hijack();
  });

  // DELETE /mcp — explicit session termination
  app.delete('/mcp', async (request, reply) => {
    const sessionId = request.headers['mcp-session-id'] as string | undefined;

    if (!sessionId || !sessions.has(sessionId)) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const session = sessions.get(sessionId)!;
    await session.transport.close();
    sessions.delete(sessionId);
    return reply.code(200).send();
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🔍 MCP Web Search Server running on http://${HOST}:${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   MCP:    http://${HOST}:${PORT}/mcp`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down gracefully...`);
      // Close all sessions
      for (const [id, session] of sessions) {
        await session.transport.close();
        sessions.delete(id);
      }
      await app.close();
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start MCP Web Search Server:', error);
  process.exit(1);
});
