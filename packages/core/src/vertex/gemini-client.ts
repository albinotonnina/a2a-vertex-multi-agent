import { VertexAI, type GenerateContentResult, type Content } from '@google-cloud/vertexai';

import type { Logger } from '../utils/logger.js';
import { retryWithBackoff } from '../utils/retry.js';

import type {
  GeminiConfig,
  FunctionDeclaration,
  GeminiTokenUsage,
  Message,
} from './types.js';

/**
 * Client for interacting with Vertex AI Gemini models.
 */
export class GeminiClient {
  private vertexAI: VertexAI;
  private model: string;
  private generationConfig: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  private logger: Logger;

  constructor(config: GeminiConfig, logger: Logger) {
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.location,
    });

    this.model = config.model ?? 'gemini-1.5-pro';
    this.generationConfig = {
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxOutputTokens ?? 8192,
      topP: config.topP ?? 0.95,
      topK: config.topK ?? 40,
    };
    this.logger = logger;
  }

  /**
   * Generate content with optional function calling support.
   */
  async generateContent(
    messages: Message[],
    tools?: FunctionDeclaration[]
  ): Promise<{
    result: GenerateContentResult;
    usage: GeminiTokenUsage;
  }> {
    const contents: Content[] = messages.map((msg) => ({
      role: msg.role,
      parts: msg.parts.map((part) => {
        if (part.text) {
          return { text: part.text };
        }
        if (part.functionCall) {
          return { functionCall: part.functionCall };
        }
        if (part.functionResponse) {
          return { functionResponse: part.functionResponse };
        }
        return { text: '' };
      }),
    }));

    const generativeModel = this.vertexAI.preview.getGenerativeModel({
      model: this.model,
      generationConfig: this.generationConfig,
      ...(tools && tools.length > 0
        ? {
            tools: [
              {
                functionDeclarations: tools,
              },
            ],
          }
        : {}),
    });

    const startTime = Date.now();

    try {
      const result = await retryWithBackoff(
        async () => generativeModel.generateContent({ contents }),
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          onFailedAttempt: (error, attempt) => {
            this.logger.warn({ error, attempt }, 'Gemini API call failed, retrying...');
          },
        }
      );

      const duration = Date.now() - startTime;

      const usage: GeminiTokenUsage = {
        promptTokenCount: result.response.usageMetadata?.promptTokenCount ?? 0,
        candidatesTokenCount: result.response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokenCount: result.response.usageMetadata?.totalTokenCount ?? 0,
      };

      this.logger.debug(
        {
          duration,
          usage,
          model: this.model,
        },
        'Gemini API call completed'
      );

      return { result, usage };
    } catch (error) {
      const errorDetails = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error: error,
      };
      this.logger.error(errorDetails, 'Gemini API call failed after retries');
      throw error;
    }
  }

  /**
   * Generate streaming content (for future implementation).
   */
  async *generateContentStream(
    _messages: Message[],
    _tools?: FunctionDeclaration[]
  ): AsyncGenerator<string> {
    // Future implementation for streaming responses
    yield 'Streaming not yet implemented';
  }

  /**
   * Get the model name being used.
   */
  getModel(): string {
    return this.model;
  }
}
