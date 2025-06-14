import { Injectable, Logger } from '@nestjs/common';

interface ErrorLogContext {
  requestId?: string;
  userId?: string;
  method?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  [key: string]: any;
}

@Injectable()
export class AppLoggerService extends Logger {
  logError(
    error: Error | unknown,
    context?: string,
    additionalContext?: ErrorLogContext
  ): void {
    let errorMessage: string;
    let stackTrace: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      stackTrace = error.stack;
    } else {
      errorMessage = String(error);
    }

    // Format the log message with context
    const contextInfo = additionalContext
      ? Object.entries(additionalContext)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ')
      : '';

    const fullMessage = contextInfo 
      ? `${errorMessage} | ${contextInfo}`
      : errorMessage;

    super.error(fullMessage, stackTrace, context);
  }

  logInfo(
    message: string,
    context?: string,
    additionalContext?: Record<string, any>
  ): void {
    const contextInfo = additionalContext
      ? Object.entries(additionalContext)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ')
      : '';

    const fullMessage = contextInfo 
      ? `${message} | ${contextInfo}`
      : message;

    super.log(fullMessage, context);
  }

  logWarning(
    message: string,
    context?: string,
    additionalContext?: Record<string, any>
  ): void {
    const contextInfo = additionalContext
      ? Object.entries(additionalContext)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | ')
      : '';

    const fullMessage = contextInfo 
      ? `${message} | ${contextInfo}`
      : message;

    super.warn(fullMessage, context);
  }

  logDebug(
    message: string,
    context?: string,
    additionalContext?: Record<string, any>
  ): void {
    if (process.env.NODE_ENV === 'development') {
      const contextInfo = additionalContext
        ? Object.entries(additionalContext)
            .filter(([, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ')
        : '';

      const fullMessage = contextInfo 
        ? `${message} | ${contextInfo}`
        : message;

      super.debug(fullMessage, context);
    }
  }
}