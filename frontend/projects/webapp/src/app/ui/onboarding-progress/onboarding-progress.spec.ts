import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { provideTranslocoForTest } from '@app/testing/transloco-testing';

import { OnboardingProgress } from './onboarding-progress';

describe('OnboardingProgress', () => {
  it('marks the first two stages as completed on the budget stage', async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingProgress],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OnboardingProgress);
    fixture.componentRef.setInput('currentStep', 3);
    fixture.detectChanges();

    const journey = fixture.nativeElement.querySelector(
      '[data-testid="onboarding-journey"]',
    ) as HTMLElement;

    expect(journey.getAttribute('aria-label')).toBe(
      'Création de ton espace : étape 3 sur 3',
    );
    expect(journey.querySelectorAll('[data-state="completed"]')).toHaveLength(
      2,
    );
    expect(
      journey.querySelector('[aria-current="step"]')?.textContent,
    ).toContain('Premier budget');
  });
});
