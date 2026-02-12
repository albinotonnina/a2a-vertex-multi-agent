import { BaseAgent, type Tool } from '@a2a/core';

/**
 * Writer Agent - Specialized in content creation and professional writing.
 *
 * Capabilities:
 * - Synthesizing research and analysis into clear narratives
 * - Professional report writing
 * - Summary generation
 * - Content formatting (Markdown, HTML)
 * - Audience-appropriate tone and style
 */
export class WriterAgent extends BaseAgent {
  /**
   * Define the agent's role and behavior.
   */
  protected getSystemPrompt(): string {
    return `You are a professional writer specializing in creating clear, engaging, and well-structured content.

Your responsibilities:
1. Transform research findings and analysis into coherent narratives
2. Write comprehensive reports with proper structure
3. Adapt tone and style to the target audience
4. Ensure clarity, accuracy, and readability
5. Properly format content using Markdown
6. Create executive summaries and key takeaways

Guidelines:
- Start with an executive summary for longer pieces
- Use clear headings and logical structure
- Write in active voice when possible
- Keep paragraphs focused and concise
- Use bullet points and lists for clarity
- Include relevant context and background
- Cite sources when referencing specific information
- Ensure smooth transitions between sections

Output format (for reports):
# [Title]

## Executive Summary
[2-3 paragraph overview of key findings]

## Background
[Context and motivation for the research]

## Key Findings
[Main discoveries organized by theme]

## Analysis & Insights
[Interpretation and implications]

## Conclusion
[Summary and recommendations]

## Sources
[References and citations]

Formatting tools:
- Use **bold** for emphasis
- Use *italics* for subtle emphasis
- Use \`code\` for technical terms
- Use > blockquotes for important callouts
- Use tables for structured data
- Use headings (##, ###) for hierarchy

Tone:
- Professional but accessible
- Objective and evidence-based
- Clear and direct
- Engaging without being casual`;
  }

  /**
   * Register tools available to this agent.
   */
  protected async registerTools(): Promise<Tool[]> {
    return [
      {
        name: 'format_as_markdown_table',
        description: 'Convert structured data into a Markdown table',
        parameters: {
          type: 'object',
          properties: {
            headers: {
              type: 'array',
              description: 'Column headers',
            },
            rows: {
              type: 'array',
              description: 'Array of row data',
            },
          },
          required: ['headers', 'rows'],
        },
        execute: async (params) => {
          const headers = params.headers as string[];
          const rows = params.rows as string[][];

          const headerRow = `| ${headers.join(' | ')} |`;
          const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
          const dataRows = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');

          return `${headerRow}\n${separatorRow}\n${dataRows}`;
        },
      },
      {
        name: 'count_words',
        description: 'Count words in a text',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to count words in',
            },
          },
          required: ['text'],
        },
        execute: async (params) => {
          const text = params.text as string;
          const words = text.trim().split(/\s+/).length;
          return { word_count: words };
        },
      },
    ];
  }

  /**
   * Get agent identifier.
   */
  public getName(): string {
    return 'writer-agent';
  }
}
