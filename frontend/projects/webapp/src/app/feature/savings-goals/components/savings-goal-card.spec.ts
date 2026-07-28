import { provideZonelessChangeDetection, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SavingsGoal } from 'pulpe-shared';
import { UserSettingsStore } from '@core/user-settings';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { SavingsGoalCard } from './savings-goal-card';

const goal: SavingsGoal = {
  id: 'goal-1',
  userId: 'user-1',
  name: 'Vacances privées 2027',
  startDate: null,
  targetAmount: 3000,
  targetDate: '2027-08-01',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SavingsGoalCard', () => {
  let fixture: ComponentFixture<SavingsGoalCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsGoalCard],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        provideRouter([]),
        ...provideTranslocoForTest(),
        {
          provide: UserSettingsStore,
          useValue: { currency: signal('CHF') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SavingsGoalCard);
    setTestInput(fixture.componentInstance.goal, goal);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a native keyboard-focusable link to the goal detail', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/savings-goals/goal-1');
    expect(link.tabIndex).toBe(0);

    link.focus();
    expect(document.activeElement).toBe(link);
  });

  it('keeps the goal name out of attributes and disables autocapture', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    const elements = [link, ...Array.from(link.querySelectorAll('*'))];
    const attributeValues = elements.flatMap((element) =>
      element
        .getAttributeNames()
        .map((attribute) => element.getAttribute(attribute) ?? ''),
    );

    expect(link.dataset['testid']).toBe('savings-goal-goal-1');
    expect(link.classList.contains('ph-no-capture')).toBe(true);
    expect(link.classList.contains('amounts-visible')).toBe(true);
    expect(attributeValues.some((value) => value.includes(goal.name))).toBe(
      false,
    );
  });

  it.each([
    {
      label: 'target and deadline',
      overrides: { targetAmount: 3000, targetDate: '2027-08-01' },
      hasTarget: true,
      hasDeadline: true,
    },
    {
      label: 'target only',
      overrides: { targetAmount: 3000, targetDate: null },
      hasTarget: true,
      hasDeadline: false,
    },
    {
      label: 'deadline only',
      overrides: { targetAmount: null, targetDate: '2027-08-01' },
      hasTarget: false,
      hasDeadline: true,
    },
    {
      label: 'neither target nor deadline',
      overrides: { targetAmount: null, targetDate: null },
      hasTarget: false,
      hasDeadline: false,
    },
  ])(
    'renders only the available fields with $label',
    async ({ overrides, hasTarget, hasDeadline }) => {
      setTestInput(fixture.componentInstance.goal, { ...goal, ...overrides });
      await fixture.whenStable();

      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="savings-goal-target-amount"]',
        ) !== null,
      ).toBe(hasTarget);
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="savings-goal-target-date"]',
        ) !== null,
      ).toBe(hasDeadline);
    },
  );

  it('shows the optional start date without reserving an empty slot', async () => {
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="savings-goal-start-date"]',
      ),
    ).toBeNull();

    setTestInput(fixture.componentInstance.goal, {
      ...goal,
      startDate: '2027-01-01',
    });
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="savings-goal-start-date"]',
      ),
    ).not.toBeNull();
  });
});
