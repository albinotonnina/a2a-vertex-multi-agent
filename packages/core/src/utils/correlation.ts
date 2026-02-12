import { randomUUID } from 'crypto';

/**
 * Generate a unique correlation ID for request tracing.
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Validate correlation ID format (UUID v4).
 */
export function isValidCorrelationId(id: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(id);
}

/**
 * Extract correlation ID from various sources or generate a new one.
 */
export function ensureCorrelationId(id?: string): string {
  if (id && isValidCorrelationId(id)) {
    return id;
  }
  return generateCorrelationId();
}
