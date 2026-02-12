import type { FunctionDeclarationSchemaType, Schema } from '@google-cloud/vertexai';

/**
 * Gemini model configuration.
 */
export interface GeminiConfig {
  projectId: string;
  location: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}

/**
 * Function declaration for Gemini function calling.
 */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: FunctionDeclarationSchemaType;
    properties: { [k: string]: Schema };
    required?: string[];
  };
}

/**
 * Function call request from Gemini.
 */
export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Function call response to send back to Gemini.
 */
export interface FunctionResponse {
  name: string;
  response: {
    content: unknown;
  };
}

/**
 * Message in conversation history.
 */
export interface Message {
  role: 'user' | 'model';
  parts: Array<{ text?: string; functionCall?: FunctionCall; functionResponse?: FunctionResponse }>;
}

/**
 * Token usage metadata from Gemini response.
 */
export interface GeminiTokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}
