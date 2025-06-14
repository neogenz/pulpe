import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HttpErrorLocalizer {
  localize(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return this.fromHttpError(error);
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return "Une erreur inattendue s'est produite. Veuillez réessayer.";
  }

  private fromHttpError(error: HttpErrorResponse): string {
    if (error.status === 0 || error.status === -1) {
      return 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet.';
    }

    if (error.status >= 400 && error.status < 500) {
      if (error.error?.message) {
        return error.error.message;
      }
      return 'Une erreur de communication est survenue.';
    }

    if (error.status >= 500) {
      return 'Une erreur est survenue sur nos serveurs. Veuillez réessayer plus tard.';
    }

    return "Une erreur inattendue s'est produite.";
  }
}
