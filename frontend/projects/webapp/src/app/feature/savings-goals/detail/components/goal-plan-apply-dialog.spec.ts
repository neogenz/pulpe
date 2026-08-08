import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideZonelessChangeDetection } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  GoalPlanApplyDialog,
  type GoalPlanApplyDialogData,
} from './goal-plan-apply-dialog';

function configureDialog(data: GoalPlanApplyDialogData) {
  const close = vi.fn();

  TestBed.configureTestingModule({
    imports: [GoalPlanApplyDialog],
    providers: [
      provideZonelessChangeDetection(),
      ...provideTranslocoForTest(),
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });

  const fixture = TestBed.createComponent(GoalPlanApplyDialog);
  fixture.detectChanges();
  return { fixture, close };
}

function query(fixture: ComponentFixture<GoalPlanApplyDialog>, testId: string) {
  return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
}

describe('GoalPlanApplyDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('blurs the verdict when it carries a recovery projection amount', () => {
    const { fixture } = configureDialog({
      mode: 'creation',
      changes: [{ month: 8, year: 2026, before: 0, after: 175.35 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection après création : 1’375 CHF',
    });

    const verdict = query(fixture, 'goal-plan-apply-verdict').query(
      By.css('p'),
    );

    expect(verdict.nativeElement.classList).toContain('ph-no-capture');
  });

  // Adjustment is the mode-less case (savings-goal-detail-page.ts opens the
  // dialog without `mode`), and it is safe to leave readable because its two
  // possible verdicts — `simulate.verdict` and `simulate.verdictUnreached` —
  // interpolate a period, never an amount.
  it('keeps the verdict readable in adjustment mode', () => {
    const { fixture } = configureDialog({
      changes: [{ month: 8, year: 2026, before: 600, after: 450 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Objectif atteint en août 2026',
    });

    const verdict = query(fixture, 'goal-plan-apply-verdict').query(
      By.css('p'),
    );

    expect(verdict.nativeElement.classList).not.toContain('ph-no-capture');
  });

  it('keeps the confirm action clickable alongside a blurred verdict', () => {
    const { fixture, close } = configureDialog({
      mode: 'creation',
      changes: [{ month: 8, year: 2026, before: 0, after: 175.35 }],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection après création : 1’375 CHF',
    });

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('defaults a withdrawal to goal-only and explains why budget linking is unavailable', () => {
    const { fixture, close } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: 1_260,
          after: -4_500,
          hasBudget: false,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    expect(query(fixture, 'goal-plan-withdrawal-goal-only')).toBeTruthy();
    expect(
      query(fixture, 'goal-plan-withdrawal-linked-income').componentInstance
        .disabled,
    ).toBe(true);
    expect(
      query(fixture, 'goal-plan-withdrawal-no-budget').nativeElement
        .textContent,
    ).toContain('Crée d’abord le budget');

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();
    expect(close).toHaveBeenCalledWith('goal_only');
  });

  it('explains that realizing the linked forecast auto-points its Real', () => {
    const { fixture } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: 1_260,
          after: -4_500,
          hasBudget: true,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    expect(
      query(fixture, 'goal-plan-withdrawal-linked-income').nativeElement
        .textContent,
    ).toContain(
      'Réalise-la dans le budget : le Réel créé sera automatiquement pointé.',
    );
  });

  it('preserves a reloaded linked destination by default', () => {
    const { fixture, close } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: -4_500,
          after: -3_000,
          hasBudget: true,
          planWithdrawalDestination: 'linked_income',
          planWithdrawalConsumedAmount: 0,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();

    expect(close).toHaveBeenCalledWith('linked_income');
  });

  it('explains an explicit conversion away from the reloaded destination', () => {
    const { fixture } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: -4_500,
          after: -3_000,
          hasBudget: true,
          planWithdrawalDestination: 'linked_income',
          planWithdrawalConsumedAmount: 0,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    query(fixture, 'goal-plan-withdrawal-goal-only')
      .nativeElement.querySelector('input')
      .click();
    fixture.detectChanges();

    expect(
      query(fixture, 'goal-plan-withdrawal-conversion').nativeElement
        .textContent,
    ).toContain(
      'La Prévision Revenu liée sera supprimée avec la mise à jour du plan.',
    );
  });
});
