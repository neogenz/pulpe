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

  it('should warn that a spread committed when balance refresh fails', () => {
    const error = new ApiError(
      'Spread committed but recalculation failed',
      'ERR_BUDGET_LINE_SPREAD_RECALCULATION_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'Le lissage a bien été créé, mais les soldes n’ont pas pu être actualisés — recharge la page sans relancer le lissage',
    );
  });

  // Same code now reaches a single line as well as a spread, so the copy must
  // read correctly for both — no "raccourcis le lissage".
  it('should explain when a saving falls past its savings-goal deadline', () => {
    const error = new ApiError(
      'Savings goal line outside target horizon',
      'ERR_SAVINGS_GOAL_LINE_OUTSIDE_HORIZON',
      422,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      "Cette épargne tombe après l'échéance de ton objectif — repousse l'échéance ou choisis un autre objectif",
    );
  });

  it('should warn that a generation-stop decision committed when balance refresh fails', () => {
    const error = new ApiError(
      'Decision committed but recalculation failed',
      'ERR_SAVINGS_GOAL_GENERATION_STOP_RECALCULATION_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      "La décision a bien été enregistrée, mais les soldes n'ont pas pu être actualisés — recharge la page sans réessayer",
    );
  });

  it('should ask for a fresh deadline preview after a reconciliation conflict', () => {
    const error = new ApiError(
      'Candidates drifted',
      'ERR_SAVINGS_GOAL_RECONCILIATION_CONFLICT',
      409,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'Les prévisions ont changé entre-temps — vérifie la nouvelle liste et réessaie',
    );
  });

  it('should warn when deadline reconciliation committed but balance refresh failed', () => {
    const error = new ApiError(
      'Reconciliation committed but recalculation failed',
      'ERR_SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      "L'échéance et les prévisions ont bien été mises à jour, mais les soldes n'ont pas pu être actualisés — recharge la page sans réessayer",
    );
  });

  it('should ask for a fresh deletion preview when its impact changed', () => {
    const error = new ApiError(
      'Impact changed',
      'ERR_SAVINGS_GOAL_DELETION_IMPACT_CHANGED',
      409,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'Les éléments rattachés ont changé entre-temps — vérifie le nouvel impact avant de confirmer',
    );
  });

  it('should warn that deletion committed when balance refresh fails', () => {
    const error = new ApiError(
      'Deletion committed but recalculation failed',
      'ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      "L'objectif et les éléments choisis ont bien été supprimés, mais les soldes n'ont pas pu être actualisés — recharge les budgets sans relancer la suppression",
    );
  });

  it('should warn that goal creation committed when baseline recalculation fails', () => {
    const error = new ApiError(
      'Goal and baseline committed but recalculation failed',
      'ERR_SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED',
      500,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      "L'objectif et sa prévision mensuelle ont bien été créés, mais les soldes n'ont pas pu être actualisés — recharge la page sans recréer l'objectif",
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

  it('should localize HTTP 429 before error code mapping', () => {
    const rateLimited = new ApiError(
      'Too Many Requests',
      'HTTP_429',
      429,
      null,
    );
    expect(service.localizeApiError(rateLimited)).toBe(
      'Trop de tentatives — patiente une minute avant de réessayer',
    );
  });

  it('should localize client-side Zod parse errors', () => {
    const error = new ApiError(
      'Validation failed: Array must contain at most 50 element(s)',
      'ZOD_PARSE_ERROR',
      0,
      null,
    );
    expect(service.localizeApiError(error)).toBe(
      'Les données saisies ne sont pas valides — vérifie tes champs',
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
