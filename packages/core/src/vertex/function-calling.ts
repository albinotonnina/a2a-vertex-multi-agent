import type { GenerateContentResult } from '@google-cloud/vertexai';

import type { Logger } from '../utils/logger.js';

import type { FunctionCall, FunctionResponse, Message, FunctionDeclaration } from './types.js';
import type { GeminiClient } from './gemini-client.js';

/**
 * Function executor interface - implement this to handle function calls.
 */
export type FunctionExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

/**
 * Result of a function calling iteration.
 */
export interface FunctionCallingResult {
  finalAnswer?: string;
  functionCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
  totalIterations: number;
}

/**
 * Extract function calls from Gemini response.
 */
export function extractFunctionCalls(result: GenerateContentResult): FunctionCall[] {
  const functionCalls: FunctionCall[] = [];

  const candidates = result.response.candidates;
  if (!candidates || candidates.length === 0) {
    return functionCalls;
  }

  const parts = candidates[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: (part.functionCall.args as Record<string, unknown>) ?? {},
      });
    }
  }

  return functionCalls;
}

/**
 * Extract text response from Gemini result.
 */
export function extractTextResponse(result: GenerateContentResult): string | undefined {
  const candidates = result.response.candidates;
  if (!candidates || candidates.length === 0) {
    return undefined;
  }

  const parts = candidates[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.text) {
      return part.text;
    }
  }

  return undefined;
}

/**
 * Execute function calling loop until final answer is received.
 *
 * This implements the iterative function calling pattern:
 * 1. Send initial request to Gemini with available tools
 * 2. If Gemini requests function calls, execute them
 * 3. Send function results back to Gemini
 * 4. Repeat until Gemini returns final text answer
 *
 * @param client - Gemini client instance
 * @param initialMessages - Initial conversation history
 * @param tools - Available function declarations
 * @param executor - Function to execute tool calls
 * @param logger - Logger instance
 * @param maxIterations - Maximum iterations to prevent infinite loops (default: 10)
 * @returns Final answer and function call history
 */
export async function executeFunctionCallingLoop(
  client: GeminiClient,
  initialMessages: Message[],
  tools: FunctionDeclaration[],
  executor: FunctionExecutor,
  logger: Logger,
  maxIterations: number = 10
): Promise<FunctionCallingResult> {
  const messages: Message[] = [...initialMessages];
  const functionCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> =
    [];

  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;

    logger.debug({ iteration, messageCount: messages.length }, 'Function calling iteration');

    const { result } = await client.generateContent(messages, tools);

    // Check for function calls
    const calls = extractFunctionCalls(result);

    if (calls.length > 0) {
      logger.info({ calls: calls.map((c) => c.name) }, 'Executing function calls');

      // Execute all function calls in parallel
      const functionResponses: FunctionResponse[] = await Promise.all(
        calls.map(async (call) => {
          try {
            const callResult = await executor(call.name, call.args);

            functionCalls.push({
              name: call.name,
              args: call.args,
              result: callResult,
            });

            return {
              name: call.name,
              response: {
                content: callResult,
              },
            };
          } catch (error) {
            logger.error({ error, functionName: call.name }, 'Function call failed');
            return {
              name: call.name,
              response: {
                content: {
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              },
            };
          }
        })
      );

      // Add function call and responses to conversation
      messages.push({
        role: 'model',
        parts: calls.map((call) => ({ functionCall: call })),
      });

      messages.push({
        role: 'user',
        parts: functionResponses.map((resp) => ({ functionResponse: resp })),
      });

      continue;
    }

    // Check for text response (final answer)
    const textResponse = extractTextResponse(result);

    if (textResponse) {
      logger.info({ iterations: iteration }, 'Received final answer from Gemini');

      return {
        finalAnswer: textResponse,
        functionCalls,
        totalIterations: iteration,
      };
    }

    // No function calls and no text - unexpected state
    logger.warn('Gemini returned neither function calls nor text response');
    break;
  }

  if (iteration >= maxIterations) {
    logger.error({ maxIterations }, 'Function calling loop exceeded max iterations');
    throw new Error(`Function calling exceeded maximum iterations (${maxIterations})`);
  }

  throw new Error('Function calling loop terminated without final answer');
}
