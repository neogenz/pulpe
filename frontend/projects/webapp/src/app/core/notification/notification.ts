import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Service de notification utilisant MatSnackBar
 * Affiche les messages d'erreur et de succès de manière uniforme
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly #snackBar = inject(MatSnackBar);

  showError(message: string): void {
    this.#snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  showSuccess(message: string): void {
    this.#snackBar.open(message, undefined, {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }

  showInfo(message: string): void {
    this.#snackBar.open(message, undefined, {
      duration: 3000,
      panelClass: ['info-snackbar'],
      horizontalPosition: 'center',
      verticalPosition: 'top',
    });
  }
}
