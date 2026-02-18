import { Injectable } from '@angular/core';

import { type AuthError, isAuthWeakPasswordError } from '@supabase/supabase-js';

export type AuthErrorTranslations = Record<string, string>;

@Injectable({
  providedIn: 'root',
})
export class AuthErrorLocalizer {
  readonly #errorTranslations: AuthErrorTranslations = {
    'Invalid login credentials': 'Email ou mot de passe incorrect — réessaie',
    'Email not confirmed':
      'Confirme ton email pour continuer — vérifie ta boîte mail',
    'Too many requests': 'Trop de tentatives — patiente quelques minutes',
    'User already registered':
      'Cet email est déjà utilisé — tu as peut-être déjà un compte ?',
    'Signup requires a valid password': 'Choisis un mot de passe valide',
    'Password should be at least 6 characters':
      '6 caractères minimum pour le mot de passe',
    'Password should be at least 8 characters':
      '8 caractères minimum pour sécuriser ton compte',
    'Invalid email': 'Cette adresse email ne semble pas valide',
    'User not found': 'Compte introuvable — vérifie ton email',
    'Email link is invalid or has expired':
      'Ce lien a expiré — demande-en un nouveau',
    'Token has expired or is invalid':
      'Ce lien a expiré — demande-en un nouveau',
    'The new email address provided is invalid':
      'Cette adresse email ne semble pas valide',
    'Signups not allowed for this instance':
      'Les inscriptions sont fermées pour le moment',
    'Email signups are disabled': 'Les inscriptions par email sont fermées',
    'Only an email address or phone number should be provided on signup':
      "Utilise ton email pour t'inscrire",
    'To signup, please provide your email':
      "Ton email est nécessaire pour t'inscrire",
    'Weak password': 'Choisis un mot de passe plus sécurisé',
    'Password is too weak':
      'Ce mot de passe est trop simple — ajoute des caractères',
    'Session not found': 'Ta session a expiré — reconnecte-toi',
    'Session expired': 'Ta session a expiré — reconnecte-toi',
    'Network request failed': 'Problème de connexion — vérifie ton réseau',
    'Unable to validate email address: invalid format':
      'Cette adresse email ne semble pas valide',
    'Database error saving new user':
      'La création du compte a échoué — réessaie',
    'A user with this email address has already been registered':
      'Cet email est déjà utilisé — tu as peut-être déjà un compte ?',
    'OAuth error': 'La connexion avec Google a échoué — réessaie',
    'Provider error': 'La connexion a échoué — réessaie',
    'Popup closed': 'Tu as fermé la fenêtre de connexion',
    'Access denied': 'Connexion annulée',
    access_denied: 'Connexion annulée',
    user_cancelled_login: 'Connexion annulée',
    'OAuth callback error': 'La connexion avec Google a échoué — réessaie',
    'Provider not enabled': "Cette méthode de connexion n'est pas disponible",
    ERR_USER_ACCOUNT_BLOCKED: 'Ton compte est en cours de suppression.',
  };

  readonly #codeTranslations: Record<string, string> = {
    same_password: "Le nouveau mot de passe doit être différent de l'ancien",
    weak_password:
      'Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres',
    invalid_credentials: 'Email ou mot de passe incorrect — réessaie',
    user_already_exists:
      'Cet email est déjà utilisé — tu as peut-être déjà un compte ?',
    email_exists:
      'Cet email est déjà utilisé — tu as peut-être déjà un compte ?',
    email_not_confirmed:
      'Confirme ton email pour continuer — vérifie ta boîte mail',
    session_expired: 'Ta session a expiré — reconnecte-toi',
    session_not_found: 'Ta session a expiré — reconnecte-toi',
    user_not_found: 'Compte introuvable — vérifie ton email',
    otp_expired: 'Ce code a expiré — demande-en un nouveau',
    over_email_send_rate_limit:
      "Trop d'emails envoyés — patiente quelques minutes",
    over_request_rate_limit: 'Trop de tentatives — patiente quelques minutes',
    signup_disabled: 'Les inscriptions sont fermées pour le moment',
    email_provider_disabled: 'Les inscriptions par email sont fermées',
    reauthentication_needed:
      'Tu dois te reconnecter avant de modifier ton mot de passe',
    user_banned: 'Ton compte est en cours de suppression.',
    validation_failed: 'Les informations fournies ne sont pas valides',
  };

  localizeAuthError(error: AuthError): string {
    if (isAuthWeakPasswordError(error) && error.reasons.includes('pwned')) {
      return 'Ce mot de passe est trop courant — choisis-en un plus unique';
    }

    if (error.code) {
      const codeTranslation = this.#codeTranslations[error.code];
      if (codeTranslation) {
        return codeTranslation;
      }
    }

    return this.localizeError(error.message);
  }

  localizeError(originalErrorMessage: string): string {
    if (!originalErrorMessage) {
      return "Quelque chose n'a pas fonctionné — réessaie";
    }

    const trimmedMessage = originalErrorMessage.trim();
    const translatedMessage = this.#errorTranslations[trimmedMessage];

    if (translatedMessage) {
      return translatedMessage;
    }

    if (this.#containsWeakPasswordError(trimmedMessage)) {
      return 'Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres';
    }

    if (this.#containsRateLimitError(trimmedMessage)) {
      return 'Trop de tentatives — patiente quelques minutes';
    }

    if (this.#containsNetworkError(trimmedMessage)) {
      return 'Problème de connexion — vérifie ton réseau';
    }

    return "Quelque chose n'a pas fonctionné — réessaie";
  }

  #containsWeakPasswordError(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    return (
      (lowerMessage.includes('weak') && lowerMessage.includes('password')) ||
      lowerMessage.includes('strength') ||
      lowerMessage.includes('complex')
    );
  }

  #containsRateLimitError(message: string): boolean {
    const rateLimitKeywords = ['rate', 'limit', 'too many', 'throttle'];
    const lowerMessage = message.toLowerCase();
    return rateLimitKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  #containsNetworkError(message: string): boolean {
    const networkKeywords = ['network', 'connection', 'timeout', 'fetch'];
    const lowerMessage = message.toLowerCase();
    return networkKeywords.some((keyword) => lowerMessage.includes(keyword));
  }
}
