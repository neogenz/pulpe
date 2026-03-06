import { Injectable, inject } from '@angular/core';

import { type AuthError, isAuthWeakPasswordError } from '@supabase/supabase-js';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({
  providedIn: 'root',
})
export class AuthErrorLocalizer {
  readonly #transloco = inject(TranslocoService);

  readonly #errorKeyMap: Record<string, string> = {
    'Invalid login credentials': 'authError.invalidCredentials',
    'Email not confirmed': 'authError.emailNotConfirmed',
    'Too many requests': 'authError.tooManyRequests',
    'User already registered': 'authError.userAlreadyRegistered',
    'Signup requires a valid password': 'authError.signupRequiresValidPassword',
    'Password should be at least 6 characters': 'authError.passwordMinLength6',
    'Password should be at least 8 characters': 'authError.passwordMinLength8',
    'Invalid email': 'authError.invalidEmail',
    'User not found': 'authError.userNotFound',
    'Email link is invalid or has expired': 'authError.linkExpired',
    'Token has expired or is invalid': 'authError.linkExpired',
    'The new email address provided is invalid': 'authError.invalidEmail',
    'Signups not allowed for this instance': 'authError.signupsDisabled',
    'Email signups are disabled': 'authError.emailSignupsDisabled',
    'Only an email address or phone number should be provided on signup':
      'authError.useEmailToSignup',
    'To signup, please provide your email': 'authError.emailRequiredForSignup',
    'Weak password': 'authError.weakPassword',
    'Password is too weak': 'authError.passwordTooWeak',
    'Session not found': 'authError.sessionExpired',
    'Session expired': 'authError.sessionExpired',
    'Network request failed': 'authError.networkError',
    'Unable to validate email address: invalid format':
      'authError.invalidEmail',
    'Database error saving new user': 'authError.signupFailed',
    'A user with this email address has already been registered':
      'authError.userAlreadyRegistered',
    'OAuth error': 'authError.oauthError',
    'Provider error': 'authError.providerError',
    'Popup closed': 'authError.popupClosed',
    'Access denied': 'authError.accessDenied',
    access_denied: 'authError.accessDenied',
    user_cancelled_login: 'authError.accessDenied',
    'OAuth callback error': 'authError.oauthError',
    'Provider not enabled': 'authError.providerNotEnabled',
    ERR_USER_ACCOUNT_BLOCKED: 'authError.accountBlocked',
  };

  readonly #codeKeyMap: Record<string, string> = {
    same_password: 'authError.samePassword',
    weak_password: 'authError.weakPasswordStrong',
    invalid_credentials: 'authError.invalidCredentials',
    user_already_exists: 'authError.userAlreadyRegistered',
    email_exists: 'authError.userAlreadyRegistered',
    email_not_confirmed: 'authError.emailNotConfirmed',
    session_expired: 'authError.sessionExpired',
    session_not_found: 'authError.sessionExpired',
    user_not_found: 'authError.userNotFound',
    otp_expired: 'authError.otpExpired',
    over_email_send_rate_limit: 'authError.emailRateLimit',
    over_request_rate_limit: 'authError.tooManyRequests',
    signup_disabled: 'authError.signupsDisabled',
    email_provider_disabled: 'authError.emailSignupsDisabled',
    reauthentication_needed: 'authError.reauthenticationNeeded',
    user_banned: 'authError.accountBlocked',
    validation_failed: 'authError.validationFailed',
  };

  localizeAuthError(error: AuthError): string {
    if (isAuthWeakPasswordError(error) && error.reasons.includes('pwned')) {
      return this.#transloco.translate('authError.pwnedPassword');
    }

    if (error.code) {
      const codeKey = this.#codeKeyMap[error.code];
      if (codeKey) {
        return this.#transloco.translate(codeKey);
      }
    }

    return this.localizeError(error.message);
  }

  localizeError(originalErrorMessage: string): string {
    if (!originalErrorMessage) {
      return this.#transloco.translate('authError.generic');
    }

    const trimmedMessage = originalErrorMessage.trim();
    const messageKey = this.#errorKeyMap[trimmedMessage];

    if (messageKey) {
      return this.#transloco.translate(messageKey);
    }

    if (this.#containsWeakPasswordError(trimmedMessage)) {
      return this.#transloco.translate('authError.weakPasswordStrong');
    }

    if (this.#containsRateLimitError(trimmedMessage)) {
      return this.#transloco.translate('authError.tooManyRequests');
    }

    if (this.#containsNetworkError(trimmedMessage)) {
      return this.#transloco.translate('authError.networkError');
    }

    return this.#transloco.translate('authError.generic');
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
