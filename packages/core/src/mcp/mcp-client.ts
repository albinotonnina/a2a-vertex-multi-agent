import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import type { Logger } from '../utils/logger.js';

import type { MCPTool, MCPToolCallRequest, MCPToolCallResponse, MCPServerConfig } from './types.js';

/**
 * Client for interacting with MCP servers.
 */
export class MCPClient {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private config: MCPServerConfig;
  private logger: Logger;
  private connected = false;

  constructor(config: MCPServerConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Connect to the MCP server.
   */
  async connect(): Promise<void> {
    if (this.connected) {
      this.logger.debug('Already connected to MCP server');
      return;
    }

    try {
      this.logger.info({ url: this.config.url }, 'Connecting to MCP server');

      // Create Streamable HTTP transport
      this.transport = new StreamableHTTPClientTransport(new URL(this.config.url));

      // Create client
      this.client = new Client(
        {
          name: 'a2a-agent',
          version: '0.1.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to server
      await this.client.connect(this.transport);

      this.connected = true;
      this.logger.info('Successfully connected to MCP server');
    } catch (error) {
      this.logger.error({ error, url: this.config.url }, 'Failed to connect to MCP server');
      throw new Error(`Failed to connect to MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      if (this.client) {
        await this.client.close();
      }

      this.client = null;
      this.transport = null;
      this.connected = false;

      this.logger.info('Disconnected from MCP server');
    } catch (error) {
      this.logger.error({ error }, 'Error disconnecting from MCP server');
    }
  }

  /**
   * List available tools from the MCP server.
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const response = await this.client.listTools();

      const tools: MCPTool[] = response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? '',
        inputSchema: tool.inputSchema as {
          type: string;
          properties?: Record<string, unknown>;
          required?: string[];
        },
      }));

      this.logger.debug({ toolCount: tools.length, tools: tools.map((t) => t.name) }, 'Listed MCP tools');

      return tools;
    } catch (error) {
      this.logger.error({ error }, 'Failed to list MCP tools');
      throw error;
    }
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(request: MCPToolCallRequest): Promise<MCPToolCallResponse> {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to MCP server');
    }

    try {
      this.logger.debug({ tool: request.name, args: request.arguments }, 'Calling MCP tool');

      const response = await this.client.callTool({
        name: request.name,
        arguments: request.arguments,
      });

      this.logger.debug({ tool: request.name }, 'MCP tool call completed');

      return {
        content: (response.content as Array<{ type: string; text?: string; data?: unknown }>).map(
          (item) => ({
            type: item.type,
            text: 'text' in item ? item.text : undefined,
            data: 'data' in item ? item.data : undefined,
          })
        ),
        isError: Boolean(response.isError),
      };
    } catch (error) {
      this.logger.error({ error, tool: request.name }, 'MCP tool call failed');
      throw error;
    }
  }

  /**
   * Check if connected to MCP server.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server URL.
   */
  getServerUrl(): string {
    return this.config.url;
  }
}
