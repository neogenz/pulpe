import {
  type HttpInterceptorFn,
  type HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ErrorMessageMapper } from '@core/error/error-message-mapper';
import { NotificationService } from '@core/notification/notification';
import { environment } from '@env/environment';

/**
 * Intercepteur HTTP fonctionnel pour la gestion des erreurs
 * Utilise le pattern d'intercepteur fonctionnel (Angular 17+)
 * Transforme les erreurs HTTP en messages utilisateur et les affiche via MatSnackBar
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorMapper = inject(ErrorMessageMapper);
  const notification = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Transformer en message user-friendly
      const userMessage = errorMapper.getErrorMessage(error);

      // Afficher via MatSnackBar
      notification.showError(userMessage);

      // Logger en dev
      if (!environment.production) {
        console.error('HTTP Error:', {
          url: error.url,
          status: error.status,
          message: userMessage,
          originalError: error,
        });
      }

      // Propager l'erreur transformée pour que les composants puissent réagir
      return throwError(() => ({
        message: userMessage,
        status: error.status,
      }));
    }),
  );
};
