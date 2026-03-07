import { TestBed } from '@angular/core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { ApiErrorLocalizer } from './api-error-localizer';
import { ApiError } from './api-error';

describe('ApiErrorLocalizer', () => {
  let service: ApiErrorLocalizer;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...provideTranslocoForTest(), ApiErrorLocalizer],
    });
    service = TestBed.inject(ApiErrorLocalizer);
  });

  it('should localize known error codes', () => {
    const error = new ApiError(
      'Budget not found',
      'ERR_BUDGET_NOT_FOUND',
      404,
      null,
    );
    expect(service.localizeApiError(error)).toBe('Budget introuvable');
  });

  it('should localize budget creation error', () => {
    const error = new ApiError(
      'Creation failed',
      'ERR_BUDGET_CREATE_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'La création du budget a échoué — réessaie',
    );
  });

  it('should localize template errors', () => {
    const error = new ApiError(
      'Not found',
      'ERR_TEMPLATE_NOT_FOUND',
      404,
      null,
    );
    expect(service.localizeApiError(error)).toBe('Modèle introuvable');
  });

  it('should localize transaction errors', () => {
    const error = new ApiError(
      'Failed',
      'ERR_TRANSACTION_UPDATE_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'La modification de la transaction a échoué — réessaie',
    );
  });

  it('should localize auth-related API errors', () => {
    const unauthorized = new ApiError(
      'Unauthorized',
      'ERR_AUTH_UNAUTHORIZED',
      401,
      null,
    );
    expect(service.localizeApiError(unauthorized)).toBe(
      'Tu dois te connecter pour continuer',
    );
  });

  it('should return generic message for unknown error codes', () => {
    const error = new ApiError('Unknown', 'ERR_UNKNOWN_CODE', 500, null);
    expect(service.localizeApiError(error)).toBe(
      'Une erreur est survenue — réessaie',
    );
  });

  it('should return generic message for errors without code', () => {
    const error = new ApiError('Some error', undefined, 500, null);
    expect(service.localizeApiError(error)).toBe(
      'Une erreur est survenue — réessaie',
    );
  });
});
