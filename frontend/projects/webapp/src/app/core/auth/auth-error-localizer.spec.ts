import { AuthApiError, AuthWeakPasswordError } from '@supabase/supabase-js';

import { AuthErrorLocalizer } from './auth-error-localizer';

describe('AuthErrorLocalizer', () => {
  let service: AuthErrorLocalizer;

  beforeEach(() => {
    service = new AuthErrorLocalizer();
  });

  it('should localize known error messages', () => {
    expect(service.localizeError('Invalid login credentials')).toBe(
      'Email ou mot de passe incorrect — on réessaie ?',
    );
    expect(service.localizeError('User already registered')).toBe(
      'Cet email est déjà utilisé — tu as peut-être déjà un compte ?',
    );
    expect(service.localizeError('Too many requests')).toBe(
      'Trop de tentatives — patiente quelques minutes',
    );
  });

  it('should handle empty or null messages', () => {
    expect(service.localizeError('')).toBe(
      "Quelque chose n'a pas fonctionné — réessayons",
    );
    expect(service.localizeError(null as unknown as string)).toBe(
      "Quelque chose n'a pas fonctionné — réessayons",
    );
    expect(service.localizeError(undefined as unknown as string)).toBe(
      "Quelque chose n'a pas fonctionné — réessayons",
    );
  });

  it('should detect weak password errors', () => {
    expect(service.localizeError('Password is too weak for user')).toBe(
      'Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres',
    );
    expect(service.localizeError('Weak password detected')).toBe(
      'Choisis un mot de passe plus sécurisé — 8 caractères avec lettres et chiffres',
    );
  });

  it('should detect rate limit errors', () => {
    expect(service.localizeError('Rate limit exceeded')).toBe(
      'Trop de tentatives — patiente quelques minutes',
    );
    expect(service.localizeError('Too many requests from this IP')).toBe(
      'Trop de tentatives — patiente quelques minutes',
    );
  });

  it('should detect network errors', () => {
    expect(service.localizeError('Network connection failed')).toBe(
      'Problème de connexion — vérifie ton réseau',
    );
    expect(service.localizeError('Fetch timeout error')).toBe(
      'Problème de connexion — vérifie ton réseau',
    );
  });

  it('should return default message for unknown errors', () => {
    expect(service.localizeError('Some unknown error message')).toBe(
      "Quelque chose n'a pas fonctionné — réessayons",
    );
    expect(service.localizeError('Random error text')).toBe(
      "Quelque chose n'a pas fonctionné — réessayons",
    );
  });

  it('should localize OAuth cancellation errors', () => {
    expect(service.localizeError('access_denied')).toBe('Connexion annulée');
    expect(service.localizeError('user_cancelled_login')).toBe(
      'Connexion annulée',
    );
    expect(service.localizeError('Access denied')).toBe('Connexion annulée');
  });

  describe('localizeAuthError', () => {
    it('should return pwned message for weak password with pwned reason', () => {
      const error = new AuthWeakPasswordError('Password is too weak', 422, [
        'pwned',
      ]);

      expect(service.localizeAuthError(error)).toBe(
        'Ce mot de passe est trop courant — choisis-en un plus unique',
      );
    });

    it('should return generic weak password message for non-pwned reasons', () => {
      const error = new AuthWeakPasswordError('Password is too weak', 422, [
        'characters',
      ]);

      expect(service.localizeAuthError(error)).toBe(
        'Ce mot de passe est trop simple — ajoute des caractères',
      );
    });

    it('should delegate to localizeError for non-weak-password errors', () => {
      const error = new AuthApiError(
        'Invalid login credentials',
        401,
        'invalid_credentials',
      );

      expect(service.localizeAuthError(error)).toBe(
        'Email ou mot de passe incorrect — on réessaie ?',
      );
    });
  });
});
