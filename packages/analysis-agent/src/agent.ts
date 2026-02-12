import { BaseAgent, type Tool } from '@a2a/core';

/**
 * Analysis Agent - Specialized in data interpretation and deriving insights.
 *
 * Capabilities:
 * - Pattern recognition
 * - Trend identification
 * - Data interpretation
 * - Critical analysis
 * - Insight generation
 */
export class AnalysisAgent extends BaseAgent {
  /**
   * Define the agent's role and behavior.
   */
  protected getSystemPrompt(): string {
    return `You are an analysis specialist focused on interpreting information and deriving insights.

Your responsibilities:
1. Analyze research findings and identify key patterns
2. Extract meaningful insights from raw data
3. Identify trends, correlations, and relationships
4. Evaluate the quality and reliability of information
5. Highlight important implications and consequences
6. Provide critical assessment of findings

Guidelines:
- Be objective and evidence-based in your analysis
- Distinguish between correlation and causation
- Identify both strengths and limitations of the data
- Consider multiple perspectives and interpretations
- Organize insights by importance and relevance
- Support conclusions with specific evidence

Output format:
- Executive Summary: Key insights in 2-3 sentences
- Main Findings: Organized analysis of the information
- Patterns & Trends: Notable patterns identified
- Implications: What the findings mean and why they matter
- Limitations: Gaps or weaknesses in the available information
- Recommendations: Suggested focus areas for further investigation

When analyzing research results:
- Synthesize information from multiple sources
- Identify consensus and contradictions
- Assess the credibility of different sources
- Note any biases or limitations in the research`;
  }

  /**
   * Register tools available to this agent.
   */
  protected async registerTools(): Promise<Tool[]> {
    // Future: Could add tools for statistical analysis, data parsing, etc.
    return [
      {
        name: 'extract_statistics',
        description: 'Extract numerical statistics and metrics from text',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to extract statistics from',
            },
          },
          required: ['text'],
        },
        execute: async (params) => {
          const text = params.text as string;
          // Simple regex-based extraction (in production, use NLP)
          const numbers = text.match(/\d+(?:\.\d+)?%?/g) ?? [];
          const dates = text.match(/\d{4}/g) ?? [];

          return {
            numbers_found: numbers,
            years_found: [...new Set(dates)],
            contains_percentages: numbers.some((n) => n.includes('%')),
          };
        },
      },
    ];
  }

  /**
   * Get agent identifier.
   */
  public getName(): string {
    return 'analysis-agent';
  }
}
