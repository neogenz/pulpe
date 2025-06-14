import { AuthErrorLocalizer } from './auth-error-localizer';

describe('AuthErrorLocalizer', () => {
  let service: AuthErrorLocalizer;

  beforeEach(() => {
    service = new AuthErrorLocalizer();
  });

  it('should localize known error messages', () => {
    expect(service.localizeError('Invalid login credentials')).toBe(
      'Email ou mot de passe incorrect',
    );
    expect(service.localizeError('User already registered')).toBe(
      'Cet email est déjà utilisé',
    );
    expect(service.localizeError('Too many requests')).toBe(
      'Trop de tentatives de connexion. Veuillez réessayer plus tard',
    );
  });

  it('should handle empty or null messages', () => {
    expect(service.localizeError('')).toBe(
      "Une erreur inattendue s'est produite",
    );
    expect(service.localizeError(null as string)).toBe(
      "Une erreur inattendue s'est produite",
    );
    expect(service.localizeError(undefined as unknown as string)).toBe(
      "Une erreur inattendue s'est produite",
    );
  });

  it('should detect weak password errors', () => {
    expect(service.localizeError('Password is too weak for user')).toBe(
      'Le mot de passe doit contenir au moins 8 caractères avec des lettres et des chiffres',
    );
    expect(service.localizeError('Weak password detected')).toBe(
      'Le mot de passe doit contenir au moins 8 caractères avec des lettres et des chiffres',
    );
  });

  it('should detect rate limit errors', () => {
    expect(service.localizeError('Rate limit exceeded')).toBe(
      'Trop de tentatives. Veuillez patienter avant de réessayer',
    );
    expect(service.localizeError('Too many requests from this IP')).toBe(
      'Trop de tentatives. Veuillez patienter avant de réessayer',
    );
  });

  it('should detect network errors', () => {
    expect(service.localizeError('Network connection failed')).toBe(
      'Problème de connexion. Vérifiez votre connexion internet',
    );
    expect(service.localizeError('Fetch timeout error')).toBe(
      'Problème de connexion. Vérifiez votre connexion internet',
    );
  });

  it('should return default message for unknown errors', () => {
    expect(service.localizeError('Some unknown error message')).toBe(
      "Une erreur inattendue s'est produite. Veuillez réessayer",
    );
    expect(service.localizeError('Random error text')).toBe(
      "Une erreur inattendue s'est produite. Veuillez réessayer",
    );
  });
});
