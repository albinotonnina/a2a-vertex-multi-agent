import pino from 'pino';

export interface LoggerConfig {
  level?: string;
  name?: string;
  prettyPrint?: boolean;
}

/**
 * Create a structured logger instance with optional pretty printing for development.
 */
export function createLogger(config: LoggerConfig = {}): pino.Logger {
  const { level = 'info', name = 'a2a', prettyPrint = process.env.NODE_ENV !== 'production' } = config;

  const pinoConfig: pino.LoggerOptions = {
    level,
    name,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (prettyPrint) {
    return pino(pinoConfig, pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard',
      },
    }));
  }

  return pino(pinoConfig);
}

/**
 * Create a child logger with additional context.
 */
export function createChildLogger(
  parent: pino.Logger,
  bindings: Record<string, unknown>
): pino.Logger {
  return parent.child(bindings);
}

export type Logger = pino.Logger;
