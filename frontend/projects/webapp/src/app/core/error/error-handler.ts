import { type ErrorHandler, Injectable, inject } from '@angular/core';
import { Logger } from '@core/logging/logger';
import { environment } from '@env/environment';

/**
 * ErrorHandler minimal pour les erreurs non gérées
 * Ne fait que logger les erreurs, pas de gestion d'état
 * Suit le principe KISS : juste un filet de sécurité pour éviter les crashs
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  readonly #logger = inject(Logger);

  handleError(error: unknown): void {
    // Convertir en Error si nécessaire
    const err = error instanceof Error ? error : new Error(String(error));

    // Logger via le service de logging
    this.#logger.error('Unhandled error', err);

    // En dev, afficher dans la console pour faciliter le debug
    if (!environment.production) {
      console.error('Unhandled error:', err);
    }
  }
}
