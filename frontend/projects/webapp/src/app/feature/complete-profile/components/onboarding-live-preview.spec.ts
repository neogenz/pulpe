import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';

import { OnboardingLivePreview } from './onboarding-live-preview';

describe('OnboardingLivePreview', () => {
  let fixture: ComponentFixture<OnboardingLivePreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingLivePreview],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  function createComponent(prefersReducedMotion = false): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: prefersReducedMotion,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );

    fixture = TestBed.createComponent(OnboardingLivePreview);
    const component = fixture.componentInstance;
    setTestInput(component.firstName, 'Maxime');
    setTestInput(component.monthlyIncome, 5000);
    setTestInput(component.payDayOfMonth, 3);
    setTestInput(component.currencyCode, 'CHF');
    setTestInput(component.currencyFlag, '🇨🇭');
    setTestInput(component.monthLabel, 'août');
    setTestInput(component.isReady, true);
    fixture.detectChanges();
  }

  it('exposes the preview as a named region', async () => {
    createComponent();
    await fixture.whenStable();

    const preview = fixture.nativeElement.querySelector(
      '.onboarding-live-preview',
    );
    expect(preview?.getAttribute('role')).toBe('region');
    expect(preview?.getAttribute('aria-label')).toBe('Aperçu');
  });

  it('disables component animations when reduced motion is preferred', async () => {
    createComponent(true);
    await fixture.whenStable();

    const component = fixture.componentInstance as unknown as {
      prefersReducedMotion: () => boolean;
    };
    expect(component.prefersReducedMotion()).toBe(true);
  });
});
