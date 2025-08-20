import { type HttpErrorResponse } from '@angular/common/http';

/**
 * Extract a user-friendly error message from various error types
 * Messages are in French to match the UI language
 */
export function extractErrorMessage(error: unknown): string {
  // Handle HttpErrorResponse
  if (isHttpErrorResponse(error)) {
    return getHttpErrorMessage(error);
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Check for specific error messages
    if (error.message.includes('Session expirée')) {
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    }
    if (error.message.includes('Network')) {
      return 'Erreur de connexion. Vérifiez votre connexion internet.';
    }
    // Return the error message if it's meaningful
    if (error.message && error.message.length < 100) {
      return error.message;
    }
  }

  // Default generic message
  return 'Une erreur inattendue est survenue. Veuillez réessayer.';
}

/**
 * Type guard to check if an error is an HttpErrorResponse
 */
function isHttpErrorResponse(error: unknown): error is HttpErrorResponse {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    'statusText' in error
  );
}

/**
 * Get a user-friendly message based on HTTP error status
 */
function getHttpErrorMessage(error: HttpErrorResponse): string {
  // Check for error response body with message
  if (error.error) {
    // Handle API error response with message field
    if (typeof error.error === 'object' && 'message' in error.error) {
      const message = error.error.message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    // Handle string error responses
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }
  }

  // Handle specific HTTP status codes
  switch (error.status) {
    case 0:
      return 'Impossible de contacter le serveur. Vérifiez votre connexion internet.';
    case 400:
      return 'Les données envoyées sont invalides. Veuillez vérifier les informations saisies.';
    case 401:
      return 'Votre session a expiré. Veuillez vous reconnecter.';
    case 403:
      return "Vous n'avez pas les droits nécessaires pour effectuer cette action.";
    case 404:
      return "La ressource demandée n'existe pas ou a été supprimée.";
    case 409:
      return 'Un conflit est survenu. Cette ressource existe peut-être déjà.';
    case 422:
      return 'Les données saisies ne sont pas valides. Veuillez vérifier le formulaire.';
    case 429:
      return 'Trop de requêtes. Veuillez patienter avant de réessayer.';
    case 500:
      return 'Une erreur serveur est survenue. Veuillez réessayer plus tard.';
    case 502:
    case 503:
      return 'Le service est temporairement indisponible. Veuillez réessayer dans quelques instants.';
    case 504:
      return 'Le serveur met trop de temps à répondre. Veuillez réessayer.';
    default:
      // For other status codes, use status text if available
      if (error.statusText && error.statusText !== 'Unknown Error') {
        return `Erreur ${error.status}: ${error.statusText}`;
      }
      return `Une erreur est survenue (Code: ${error.status}). Veuillez réessayer.`;
  }
}

/**
 * Determine if an error is related to network connectivity
 */
export function isNetworkError(error: unknown): boolean {
  if (isHttpErrorResponse(error)) {
    return error.status === 0;
  }
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('fetch')
    );
  }
  return false;
}

/**
 * Determine if an error is related to authentication
 */
export function isAuthError(error: unknown): boolean {
  if (isHttpErrorResponse(error)) {
    return error.status === 401 || error.status === 403;
  }
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes('auth') ||
      error.message.toLowerCase().includes('session') ||
      error.message.toLowerCase().includes('token')
    );
  }
  return false;
}
