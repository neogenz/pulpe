import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { AuthCredentialsService } from '@core/auth';
import { Logger } from '@core/logging/logger';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import Login from './login';

function createMockActivatedRoute(params: Record<string, string> = {}) {
  return {
    snapshot: {
      queryParamMap: {
        get: (key: string) => params[key] ?? null,
      },
    },
  };
}

describe('Login', () => {
  let component: Login;
  let mockAuthCredentials: { signInWithEmail: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn> };
  let navigateSpy: ReturnType<typeof vi.fn>;

  async function setupComponent(
    queryParams: Record<string, string> = {},
  ): Promise<void> {
    mockAuthCredentials = { signInWithEmail: vi.fn() };
    mockLogger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
        { provide: AuthCredentialsService, useValue: mockAuthCredentials },
        { provide: Logger, useValue: mockLogger },
        {
          provide: ActivatedRoute,
          useValue: createMockActivatedRoute(queryParams),
        },
      ],
    }).compileComponents();

    component = TestBed.createComponent(Login).componentInstance;

    const router = TestBed.inject(Router);
    navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  describe('Component Structure', () => {
    beforeEach(async () => {
      await setupComponent();
    });

    it('should create successfully', () => {
      expect(component).toBeTruthy();
    });

    it('should have errorMessage empty by default with no query params', () => {
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('Scheduled deletion query params', () => {
    it('should set harmonized error message with Swiss date when reason=scheduled-deletion', async () => {
      await setupComponent({
        reason: 'scheduled-deletion',
        date: '2026-02-26T00:00:00Z',
      });

      expect(component['errorMessage']()).toBe(
        "Ton compte est programmé pour suppression le 26.02.2026. Si c'est une erreur, contacte le support.",
      );
    });

    it('should format date in Swiss format (dd.MM.yyyy)', async () => {
      await setupComponent({
        reason: 'scheduled-deletion',
        date: '2026-12-01T00:00:00Z',
      });

      expect(component['errorMessage']()).toContain('01.12.2026');
    });

    it('should not set error message when reason is missing', async () => {
      await setupComponent({ date: '2026-02-26T00:00:00Z' });

      expect(component['errorMessage']()).toBe('');
    });

    it('should not set error message when date is missing', async () => {
      await setupComponent({ reason: 'scheduled-deletion' });

      expect(component['errorMessage']()).toBe('');
    });

    it('should not set error message when reason is a different value', async () => {
      await setupComponent({
        reason: 'other-reason',
        date: '2026-02-26T00:00:00Z',
      });

      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('signIn', () => {
    beforeEach(async () => {
      await setupComponent();
    });

    it('should navigate to dashboard on successful sign in', async () => {
      mockAuthCredentials.signInWithEmail.mockResolvedValue({ success: true });

      component['loginForm'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });

      await component['signIn']();

      expect(navigateSpy).toHaveBeenCalledWith(['/', 'dashboard']);
    });

    it('should set error message on failed sign in', async () => {
      mockAuthCredentials.signInWithEmail.mockResolvedValue({
        success: false,
        error: 'Email ou mot de passe incorrect',
      });

      component['loginForm'].patchValue({
        email: 'test@example.com',
        password: 'password123',
      });

      await component['signIn']();

      expect(component['errorMessage']()).toBe(
        'Email ou mot de passe incorrect',
      );
    });

    it('should set error message when form is invalid', async () => {
      await component['signIn']();

      expect(component['errorMessage']()).toBe(
        'Quelques champs à vérifier avant de continuer',
      );
      expect(mockAuthCredentials.signInWithEmail).not.toHaveBeenCalled();
    });
  });

  describe('clearMessages', () => {
    beforeEach(async () => {
      await setupComponent();
    });

    it('should reset errorMessage to empty string', () => {
      component['errorMessage'].set('Some error');
      component['clearMessages']();
      expect(component['errorMessage']()).toBe('');
    });
  });

  describe('Date formatting', () => {
    it('new Date toLocaleDateString fr-CH produces dd.MM.yyyy format', () => {
      const formatted = new Date('2026-02-26T00:00:00Z').toLocaleDateString(
        'fr-CH',
      );
      expect(formatted).toBe('26.02.2026');
    });
  });
});
