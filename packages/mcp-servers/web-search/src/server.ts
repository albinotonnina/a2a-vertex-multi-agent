import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import Fastify from 'fastify';
import { z } from 'zod';

/**
 * Perform real web search using Brave Search API or DuckDuckGo HTML scraping.
 */
async function performWebSearch(query: string): Promise<string> {
  const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (braveApiKey) {
    return performBraveSearch(query, braveApiKey);
  } else {
    return performDuckDuckGoSearch(query);
  }
}

/**
 * Search using Brave Search API (requires API key).
 * Get free API key at: https://brave.com/search/api/
 */
async function performBraveSearch(query: string, apiKey: string): Promise<string> {
  try {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', '5');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    const results = (data.web?.results || []).map((result: any) => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
    }));

    return JSON.stringify(
      {
        query,
        results,
        source: 'Brave Search API',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  } catch (error) {
    console.error('Brave Search error:', error);
    // Fallback to DuckDuckGo
    return performDuckDuckGoSearch(query);
  }
}

/**
 * Search using DuckDuckGo HTML (no API key needed).
 * This is a simple implementation - for production, consider using their API or a library.
 */
async function performDuckDuckGoSearch(query: string): Promise<string> {
  try {
    const url = new URL('https://html.duckduckgo.com/html/');
    url.searchParams.set('q', query);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; A2A-Bot/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo error: ${response.status}`);
    }

    const html = await response.text();
    const results = parseDuckDuckGoResults(html);

    return JSON.stringify(
      {
        query,
        results: results.slice(0, 5), // Limit to 5 results
        source: 'DuckDuckGo',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  } catch (error) {
    console.error('DuckDuckGo search error:', error);
    // Return error as mock results so the agent can still respond
    return JSON.stringify(
      {
        query,
        results: [
          {
            title: 'Search temporarily unavailable',
            url: 'https://duckduckgo.com',
            snippet: `Unable to perform web search for "${query}". The search service is temporarily unavailable. This is a fallback response.`,
          },
        ],
        source: 'Fallback',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      null,
      2
    );
  }
}

/**
 * Parse DuckDuckGo HTML results.
 * Note: HTML parsing is fragile - for production, use an official API.
 */
function parseDuckDuckGoResults(html: string): Array<{ title: string; url: string; snippet: string }> {
  const results: Array<{ title: string; url: string; snippet: string }> = [];

  // Simple regex-based parsing (fragile but works for demo)
  // Match result blocks in DuckDuckGo HTML
  const resultRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]+)<\/a>/g;

  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < 10) {
    const [, url, title, snippet] = match;
    if (url && title && snippet) {
      results.push({
        title: title.trim(),
        url: decodeURIComponent(url),
        snippet: snippet.trim().replace(/\s+/g, ' '),
      });
    }
  }

  // If regex parsing failed, try alternative pattern
  if (results.length === 0) {
    const altRegex =
      /<h2[^>]*class="result__title"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?class="result__snippet"[^>]*>([^<]+)</g;
    while ((match = altRegex.exec(html)) !== null && results.length < 10) {
      const [, url, title, snippet] = match;
      if (url && title && snippet) {
        results.push({
          title: title.trim(),
          url: decodeURIComponent(url),
          snippet: snippet.trim().replace(/\s+/g, ' '),
        });
      }
    }
  }

  return results;
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
