import { inject } from '@angular/core';
import {
  type NavigationError,
  type NavigationErrorHandlerFeature,
  withNavigationErrorHandler,
} from '@angular/router';
import { PAGE_RELOAD } from '../page-reload';
import { Logger } from '../logging/logger';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { StorageService } from '../storage/storage.service';

/**
 * Detect "stale chunk" errors — happens when a long-lived tab tries to
 * lazy-load a JS chunk whose hash no longer exists on the server (typical
 * after a deploy invalidates the previous build).
 *
 * Browser-specific messages:
 * - Safari: "Importing a module script failed."
 * - Chrome/Edge: "Failed to fetch dynamically imported module"
 * - Firefox: "error loading dynamically imported module"
 * - Webpack: error.name === 'ChunkLoadError'
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === 'ChunkLoadError') {
    return true;
  }
  const message = error.message ?? '';
  return (
    message.includes('Importing a module script failed') ||
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module')
  );
}

/**
 * Recovery handler for `withNavigationErrorHandler`. Detects stale chunk
 * errors during lazy route loading and triggers a one-shot page reload to
 * fetch a fresh `index.html` (which references the new chunk hashes).
 *
 * The sessionStorage guard prevents an infinite reload loop if the server
 * is genuinely serving broken assets — after one failed reload, the error
 * propagates normally and gets reported via `GlobalErrorHandler`.
 */
export function handleNavigationError(navigationError: NavigationError): void {
  if (!isChunkLoadError(navigationError.error)) {
    return;
  }

  const storage = inject(StorageService);
  const reload = inject(PAGE_RELOAD);
  const logger = inject(Logger);

  if (storage.getString(STORAGE_KEYS.CHUNK_RELOAD_GUARD, 'session')) {
    logger.warn(
      '[NavigationError] Chunk load failed again after reload attempt — letting the error propagate',
    );
    return;
  }

  storage.setString(STORAGE_KEYS.CHUNK_RELOAD_GUARD, '1', 'session');
  logger.warn(
    '[NavigationError] Stale chunk detected during navigation, reloading to fetch fresh index.html',
    { url: navigationError.url },
  );
  reload();
}

/**
 * Router feature factory — wires `handleNavigationError` into `provideRouter`.
 */
export function withChunkReloadRecovery(): NavigationErrorHandlerFeature {
  return withNavigationErrorHandler(handleNavigationError);
}
