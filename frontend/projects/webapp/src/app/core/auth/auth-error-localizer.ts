import { Injectable } from '@angular/core';

export type AuthErrorTranslations = Record<string, string>;

@Injectable({
  providedIn: 'root',
})
export class AuthErrorLocalizer {
  private readonly errorTranslations: AuthErrorTranslations = {
    'Invalid login credentials': 'Email ou mot de passe incorrect',
    'Email not confirmed':
      'Veuillez confirmer votre email avant de vous connecter',
    'Too many requests':
      'Trop de tentatives de connexion. Veuillez réessayer plus tard',
    'User already registered': 'Cet email est déjà utilisé',
    'Signup requires a valid password': 'Le mot de passe doit être valide',
    'Password should be at least 6 characters':
      'Le mot de passe doit contenir au moins 6 caractères',
    'Password should be at least 8 characters':
      'Le mot de passe doit contenir au moins 8 caractères',
    'Invalid email': 'Adresse email invalide',
    'User not found': 'Utilisateur introuvable',
    'Email link is invalid or has expired':
      'Le lien email est invalide ou a expiré',
    'Token has expired or is invalid': 'Le token a expiré ou est invalide',
    'The new email address provided is invalid':
      'La nouvelle adresse email fournie est invalide',
    'Signups not allowed for this instance':
      'Les inscriptions ne sont pas autorisées',
    'Email signups are disabled': 'Les inscriptions par email sont désactivées',
    'Only an email address or phone number should be provided on signup':
      "Seul un email ou un numéro de téléphone doit être fourni lors de l'inscription",
    'To signup, please provide your email':
      'Pour vous inscrire, veuillez fournir votre email',
    'Weak password': 'Mot de passe trop faible',
    'Password is too weak': 'Le mot de passe est trop faible',
    'Session not found': 'Session introuvable',
    'Session expired': 'Session expirée',
    'Network request failed':
      'Erreur de réseau. Vérifiez votre connexion internet',
    'Unable to validate email address: invalid format':
      "Format d'email invalide",
    'Database error saving new user': 'Erreur lors de la création du compte',
    'A user with this email address has already been registered':
      'Un utilisateur avec cet email est déjà inscrit',
    'OAuth error': 'Erreur de connexion avec Google',
    'Provider error': "Erreur du fournisseur d'authentification",
    'Popup closed': 'La fenêtre de connexion a été fermée',
    'Access denied': 'Connexion annulée',
    access_denied: 'Connexion annulée',
    user_cancelled_login: 'Connexion annulée',
    'OAuth callback error': 'Erreur lors du retour de Google',
    'Provider not enabled':
      "Ce fournisseur d'authentification n'est pas activé",
  };

  localizeError(originalErrorMessage: string): string {
    if (!originalErrorMessage) {
      return "Une erreur inattendue s'est produite";
    }

    const trimmedMessage = originalErrorMessage.trim();
    const translatedMessage = this.errorTranslations[trimmedMessage];

    if (translatedMessage) {
      return translatedMessage;
    }

    if (this.containsWeakPasswordError(trimmedMessage)) {
      return 'Le mot de passe doit contenir au moins 8 caractères avec des lettres et des chiffres';
    }

    if (this.containsRateLimitError(trimmedMessage)) {
      return 'Trop de tentatives. Veuillez patienter avant de réessayer';
    }

    if (this.containsNetworkError(trimmedMessage)) {
      return 'Problème de connexion. Vérifiez votre connexion internet';
    }

    return "Une erreur inattendue s'est produite. Veuillez réessayer";
  }

  private containsWeakPasswordError(message: string): boolean {
    const weakPasswordKeywords = ['weak', 'password', 'strength', 'complex'];
    const lowerMessage = message.toLowerCase();
    return weakPasswordKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );
  }

  private containsRateLimitError(message: string): boolean {
    const rateLimitKeywords = ['rate', 'limit', 'too many', 'throttle'];
    const lowerMessage = message.toLowerCase();
    return rateLimitKeywords.some((keyword) => lowerMessage.includes(keyword));
  }

  private containsNetworkError(message: string): boolean {
    const networkKeywords = ['network', 'connection', 'timeout', 'fetch'];
    const lowerMessage = message.toLowerCase();
    return networkKeywords.some((keyword) => lowerMessage.includes(keyword));
  }
}
