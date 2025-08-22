import { Injectable } from '@angular/core';
import { type HttpErrorResponse } from '@angular/common/http';

/**
 * Service de mapping des erreurs HTTP vers des messages utilisateur
 * Suit le principe KISS : simple mapping direct sans complexité
 */
@Injectable({ providedIn: 'root' })
export class ErrorMessageMapper {
  // Mapping simple et direct des codes HTTP vers messages français
  readonly #httpErrorMessages = new Map<number, string>([
    [0, 'Pas de connexion internet'],
    [400, 'Données invalides'],
    [401, 'Session expirée, veuillez vous reconnecter'],
    [403, 'Accès non autorisé'],
    [404, 'Ressource introuvable'],
    [409, 'Conflit avec les données existantes'],
    [422, 'Données non valides'],
    [500, 'Erreur serveur, veuillez réessayer'],
    [502, 'Service temporairement indisponible'],
    [503, 'Service en maintenance'],
  ]);

  getErrorMessage(error: HttpErrorResponse): string {
    // 1. Priorité au message du backend s'il existe
    if (error.error?.message && typeof error.error.message === 'string') {
      return error.error.message;
    }

    // 2. Sinon utiliser notre mapping
    if (this.#httpErrorMessages.has(error.status)) {
      return this.#httpErrorMessages.get(error.status)!;
    }

    // 3. Message par défaut
    return 'Une erreur est survenue';
  }
}
