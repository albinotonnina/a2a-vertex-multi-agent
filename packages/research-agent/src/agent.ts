import { BaseAgent, type Tool } from '@a2a/core';

/**
 * Research Agent - Specialized in gathering information from web search.
 *
 * Capabilities:
 * - Web search via MCP integration
 * - Information synthesis
 * - Source citation
 * - Fact verification
 */
export class ResearchAgent extends BaseAgent {
  /**
   * Define the agent's role and behavior.
   */
  protected getSystemPrompt(): string {
    return `You are a research assistant specialized in gathering accurate, up-to-date information.

Your responsibilities:
1. Use web search to find relevant information for user queries
2. Synthesize information from multiple sources
3. Cite sources with URLs when providing information
4. Distinguish between facts and opinions
5. Highlight any conflicting information found
6. Provide comprehensive but concise summaries

Guidelines:
- Always use the web_search tool when you need current information
- Cross-reference multiple sources when possible
- Be transparent about limitations or uncertainty
- Format your response clearly with proper citations
- Focus on factual, verifiable information

Output format:
- Start with a brief summary (2-3 sentences)
- Provide detailed findings organized by topic
- Include a "Sources" section with all URLs referenced
- Note any limitations or areas needing further research`;
  }

  /**
   * Register tools available to this agent.
   * Uses MCP web search when configured, falls back to mock for local dev.
   */
  protected async registerTools(): Promise<Tool[]> {
    // If MCP client is connected, tools are registered via base class (mcpTools)
    if (this.mcpClient?.isConnected()) {
      return [];
    }

    // Fallback: mock tool for local development without MCP server
    return [
      {
        name: 'web_search',
        description: 'Search the web for current information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
          },
          required: ['query'],
        },
        execute: async (params) => {
          const query = params.query as string;
          return JSON.stringify({
            query,
            results: [
              {
                title: `Current information about: ${query}`,
                url: 'https://example.com/article1',
                snippet: `Comprehensive overview of ${query}. This mock demonstrates web search integration.`,
              },
              {
                title: `Latest developments in ${query}`,
                url: 'https://example.com/article2',
                snippet: `Recent updates related to ${query}. In production, this would use real search results.`,
              },
            ],
            timestamp: new Date().toISOString(),
          });
        },
      },
    ];
  }

  /**
   * Get agent identifier.
   */
  public getName(): string {
    return 'research-agent';
  }
}
