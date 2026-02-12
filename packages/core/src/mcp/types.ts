/**
 * MCP Tool definition.
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Tool call request.
 */
export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * MCP Tool call response.
 */
export interface MCPToolCallResponse {
  content: Array<{
    type: string;
    text?: string;
    data?: unknown;
  }>;
  isError?: boolean;
}

/**
 * MCP Server configuration.
 */
export interface MCPServerConfig {
  url: string;
  timeout?: number;
}
