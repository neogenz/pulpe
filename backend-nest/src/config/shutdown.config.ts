import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class ShutdownService implements OnModuleDestroy {
  #shutdownCallbacks: Array<() => Promise<void>> = [];
  #isShuttingDown = false;
  #shutdownTimeout = 30000; // 30 seconds

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ShutdownService.name);
    this.#setupShutdownHandlers();
  }

  async onModuleDestroy() {
    await this.#performShutdown();
  }

  registerShutdownCallback(callback: () => Promise<void>): void {
    this.#shutdownCallbacks.push(callback);
  }

  #setupShutdownHandlers(): void {
    // Handle various shutdown signals
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        if (!this.#isShuttingDown) {
          this.logger.info(
            {
              operation: 'shutdown_initiated',
              signal,
            },
            `Received ${signal}, starting graceful shutdown`,
          );

          await this.#performShutdown();
        }
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      this.logger.error(
        {
          operation: 'uncaught_exception',
          err: error,
        },
        'Uncaught exception, starting emergency shutdown',
      );

      await this.#performShutdown(true);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error(
        {
          operation: 'unhandled_rejection',
          reason,
          promise,
        },
        'Unhandled rejection, starting emergency shutdown',
      );

      await this.#performShutdown(true);
    });
  }

  async #performShutdown(emergency = false): Promise<void> {
    if (this.#isShuttingDown) {
      return;
    }

    this.#isShuttingDown = true;
    const startTime = Date.now();

    try {
      // Set a timeout for shutdown
      const shutdownPromise = this.#executeShutdownCallbacks();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Shutdown timeout')),
          this.#shutdownTimeout,
        ),
      );

      await Promise.race([shutdownPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.logger.info(
        {
          operation: 'shutdown_complete',
          duration,
          emergency,
        },
        'Graceful shutdown completed',
      );

      process.exit(0);
    } catch {
      const duration = Date.now() - startTime;
      this.logger.error(
        {
          operation: 'shutdown_failed',
          duration,
          emergency,
          err: error,
        },
        'Graceful shutdown failed, forcing exit',
      );

      process.exit(1);
    }
  }

  async #executeShutdownCallbacks(): Promise<void> {
    for (const callback of this.#shutdownCallbacks) {
      try {
        await callback();
      } catch {
        this.logger.error(
          {
            operation: 'shutdown_callback_failed',
            err: error,
          },
          'Shutdown callback failed',
        );
      }
    }
  }
}
