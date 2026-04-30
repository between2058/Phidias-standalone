/**
 * Structured logging utility for Next.js API routes
 * Outputs JSON in production for log aggregation systems
 * Only logs to server stdout/stderr (never to browser)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMeta {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  service?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  meta?: LogMeta;
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Generate a request ID for tracking
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format log entry as JSON or human-readable format
 */
function formatLog(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Development: human-readable format
  const parts: string[] = [`[${entry.timestamp}]`, `[${entry.level.toUpperCase()}]`];

  if (entry.requestId) {
    parts.push(`[${entry.requestId}]`);
  }

  if (entry.service) {
    parts.push(`[${entry.service}]`);
  }

  if (entry.method && entry.path) {
    parts.push(`${entry.method} ${entry.path}`);
  }

  parts.push(entry.message);

  if (entry.statusCode) {
    parts.push(`→ ${entry.statusCode}`);
  }

  if (entry.duration !== undefined) {
    parts.push(`(${entry.duration}ms)`);
  }

  return parts.join(' ');
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, meta?: Partial<LogEntry>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };

  const output = formatLog(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

/**
 * Structured logger for API proxy operations
 */
export const logger = {
  debug: (message: string, meta?: Partial<LogEntry>) => {
    if (!isProduction) {
      log('debug', message, meta);
    }
  },

  info: (message: string, meta?: Partial<LogEntry>) => {
    log('info', message, meta);
  },

  warn: (message: string, meta?: Partial<LogEntry>) => {
    log('warn', message, meta);
  },

  error: (message: string, error?: Error | unknown, meta?: Partial<LogEntry>) => {
    const errorMeta: Partial<LogEntry> = {
      ...meta,
    };

    if (error instanceof Error) {
      errorMeta.error = {
        message: error.message,
        stack: isProduction ? undefined : error.stack,
        code: (error as { code?: string }).code,
      };
    } else if (error !== undefined) {
      errorMeta.error = {
        message: String(error),
      };
    }

    log('error', message, errorMeta);
  },
};

/**
 * Create a request-specific logger with bound context
 */
export function createRequestLogger(
  requestId: string,
  service: string,
  context: {
    method: string;
    path: string;
  }
) {
  return {
    start: () => {
      logger.info('Request started', {
        requestId,
        service,
        method: context.method,
        path: context.path,
      });
    },

    success: (statusCode: number, duration: number, meta?: LogMeta) => {
      logger.info('Request completed', {
        requestId,
        service,
        method: context.method,
        path: context.path,
        statusCode,
        duration,
        meta,
      });
    },

    error: (statusCode: number, duration: number, error: Error | unknown, meta?: LogMeta) => {
      logger.error('Request failed', error, {
        requestId,
        service,
        method: context.method,
        path: context.path,
        statusCode,
        duration,
        meta,
      });
    },

    upstream: (upstreamUrl: string) => {
      logger.debug('Proxying to upstream', {
        requestId,
        service,
        meta: { upstreamUrl },
      });
    },
  };
}
