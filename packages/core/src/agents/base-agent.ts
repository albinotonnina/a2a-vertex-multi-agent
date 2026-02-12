import { createChildLogger, type Logger } from '../utils/logger.js';
import { ensureCorrelationId } from '../utils/correlation.js';
import { CostTracker } from '../utils/cost-tracker.js';
import { GeminiClient } from '../vertex/gemini-client.js';
import {
  executeFunctionCallingLoop,
  type FunctionExecutor,
} from '../vertex/function-calling.js';
import type { FunctionDeclaration, Message, GeminiConfig } from '../vertex/types.js';
import { MCPClient } from '../mcp/mcp-client.js';
import type { MCPServerConfig, MCPTool } from '../mcp/types.js';

import type { AgentInput, AgentOutput, Tool } from './types.js';

/**
 * Abstract base class for all agents in the A2A system.
 *
 * Provides:
 * - Integration with Vertex AI Gemini for LLM capabilities
 * - Optional MCP client for external tool integration
 * - Standardized request/response handling
 * - Token usage tracking and cost estimation
 * - Function calling support
 * - Observability (logging, correlation IDs)
 *
 * Subclasses must implement:
 * - getSystemPrompt(): Define agent's role and capabilities
 * - registerTools(): Define available tools (MCP or local)
 * - getName(): Return unique agent identifier
 */
export abstract class BaseAgent {
  protected geminiClient: GeminiClient;
  protected mcpClient: MCPClient | null = null;
  protected logger: Logger;
  protected costTracker: CostTracker;
  protected tools: Tool[] = [];
  protected mcpTools: MCPTool[] = [];

  constructor(
    geminiConfig: GeminiConfig,
    parentLogger: Logger,
    mcpConfig?: MCPServerConfig
  ) {
    this.logger = createChildLogger(parentLogger, { agent: this.getName() });
    this.geminiClient = new GeminiClient(geminiConfig, this.logger);
    this.costTracker = new CostTracker(geminiConfig.model);

    if (mcpConfig) {
      this.mcpClient = new MCPClient(mcpConfig, this.logger);
    }
  }

  /**
   * Get the system prompt that defines this agent's role and behavior.
   */
  protected abstract getSystemPrompt(): string;

  /**
   * Register tools available to this agent.
   * Can include both local tools and MCP tools.
   */
  protected abstract registerTools(): Promise<Tool[]>;

  /**
   * Get the unique name/identifier for this agent.
   */
  public abstract getName(): string;

  /**
   * Initialize the agent (connect to MCP servers, register tools, etc.).
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing agent');

    // Connect to MCP server if configured
    if (this.mcpClient) {
      await this.mcpClient.connect();
      this.mcpTools = await this.mcpClient.listTools();
      this.logger.info({ mcpTools: this.mcpTools.length }, 'Connected to MCP server');
    }

    // Register local tools
    this.tools = await this.registerTools();
    this.logger.info({ localTools: this.tools.length }, 'Registered local tools');
  }

  /**
   * Shutdown the agent (disconnect from MCP servers, cleanup, etc.).
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down agent');

    if (this.mcpClient) {
      await this.mcpClient.disconnect();
    }
  }

  /**
   * Process an agent request.
   *
   * This is the main entry point for all agent requests. It:
   * 1. Ensures correlation ID for tracing
   * 2. Builds the conversation with system prompt and context
   * 3. Executes function calling loop with available tools
   * 4. Tracks token usage and costs
   * 5. Returns structured response with metadata
   */
  async processRequest(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now();
    const correlationId = ensureCorrelationId(input.correlationId);

    const requestLogger = createChildLogger(this.logger, { correlationId });
    requestLogger.info({ query: input.query }, 'Processing agent request');

    try {
      // Build initial messages with system prompt
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ text: this.buildPrompt(input) }],
        },
      ];

      // Convert tools to Gemini function declarations
      const functionDeclarations = this.buildFunctionDeclarations();

      // Execute function calling loop
      const functionExecutor: FunctionExecutor = async (name, args) =>
        this.invokeTool(name, args, requestLogger);

      const { finalAnswer, functionCalls, totalIterations } = await executeFunctionCallingLoop(
        this.geminiClient,
        messages,
        functionDeclarations,
        functionExecutor,
        requestLogger
      );

      // Track token usage (get from last Gemini call)
      // Note: In production, you'd want to aggregate tokens from all calls
      const { usage } = await this.geminiClient.generateContent(messages, []);
      const tokenUsage = this.costTracker.trackUsage(
        usage.promptTokenCount,
        usage.candidatesTokenCount
      );

      const executionTime = Date.now() - startTime;

      requestLogger.info(
        {
          executionTime,
          iterations: totalIterations,
          toolsUsed: functionCalls.map((fc) => fc.name),
          tokenUsage,
        },
        'Agent request completed'
      );

      return {
        correlationId,
        result: finalAnswer ?? 'No response generated',
        metadata: {
          agentName: this.getName(),
          executionTime,
          tokenUsage,
          toolsUsed: functionCalls.map((fc) => fc.name),
          iterations: totalIterations,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      requestLogger.error(
        {
          error,
          executionTime,
        },
        'Agent request failed'
      );

      throw error;
    }
  }

  /**
   * Build the complete prompt with system instructions, query, and context.
   */
  protected buildPrompt(input: AgentInput): string {
    const parts: string[] = [];

    // System prompt
    parts.push('SYSTEM INSTRUCTIONS:');
    parts.push(this.getSystemPrompt());
    parts.push('');

    // Previous results from workflow
    if (input.previousResults && input.previousResults.length > 0) {
      parts.push('PREVIOUS AGENT RESULTS:');
      for (const prev of input.previousResults) {
        parts.push(`\n--- ${prev.agentName} ---`);
        parts.push(
          typeof prev.result === 'string' ? prev.result : JSON.stringify(prev.result, null, 2)
        );
      }
      parts.push('');
    }

    // Additional context
    if (input.context && Object.keys(input.context).length > 0) {
      parts.push('ADDITIONAL CONTEXT:');
      parts.push(JSON.stringify(input.context, null, 2));
      parts.push('');
    }

    // User query
    parts.push('USER QUERY:');
    parts.push(input.query);

    return parts.join('\n');
  }

  /**
   * Build Gemini function declarations from registered tools.
   */
  protected buildFunctionDeclarations(): FunctionDeclaration[] {
    const declarations: FunctionDeclaration[] = [];

    // Add local tools
    for (const tool of this.tools) {
      declarations.push({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: tool.parameters.type as 'object',
          properties: tool.parameters.properties as { [k: string]: any },
          required: tool.parameters.required,
        } as any,
      });
    }

    // Add MCP tools
    for (const mcpTool of this.mcpTools) {
      declarations.push({
        name: mcpTool.name,
        description: mcpTool.description,
        parameters: mcpTool.inputSchema as any,
      });
    }

    return declarations;
  }

  /**
   * Invoke a tool (either local or MCP).
   */
  protected async invokeTool(
    name: string,
    args: Record<string, unknown>,
    logger: Logger
  ): Promise<unknown> {
    logger.debug({ tool: name, args }, 'Invoking tool');

    // Check local tools first
    const localTool = this.tools.find((t) => t.name === name);
    if (localTool) {
      return localTool.execute(args);
    }

    // Check MCP tools
    const mcpTool = this.mcpTools.find((t) => t.name === name);
    if (mcpTool && this.mcpClient) {
      const response = await this.mcpClient.callTool({
        name,
        arguments: args,
      });

      if (response.isError) {
        throw new Error(`MCP tool ${name} returned error: ${JSON.stringify(response.content)}`);
      }

      // Extract text content from MCP response
      const textContent = response.content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text)
        .join('\n');

      return textContent || response.content;
    }

    throw new Error(`Tool not found: ${name}`);
  }

  /**
   * Get cost tracker metrics.
   */
  getMetrics() {
    return this.costTracker.getMetrics();
  }
}
