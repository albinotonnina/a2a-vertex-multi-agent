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
   * The web_search tool is provided via MCP server.
   */
  protected async registerTools(): Promise<Tool[]> {
    // Temporary: Add a mock web search tool since MCP isn't working yet
    return [
      {
        name: 'web_search',
        description: 'Search the web for information (mock implementation)',
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
          // Mock search results
          return {
            results: [
              {
                title: `Result for: ${query}`,
                url: 'https://example.com',
                snippet: `Mock search result for "${query}". In production, this would use real web search via MCP.`,
              },
            ],
          };
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
