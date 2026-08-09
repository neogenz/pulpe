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
    ).toContain(
      'Le retrait restera hors budget et ne changera que la projection',
    );

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();
    expect(close).toHaveBeenCalledWith([
      { month: 9, year: 2026, destination: 'goal_only' },
    ]);
  });

  it('keeps the contribution visible when planning a separate withdrawal', () => {
    const { fixture } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: 200,
          after: -500,
          contributionAmount: 200,
          hasBudget: true,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    const row = query(fixture, 'goal-plan-withdrawal-breakdown');
    expect(row.nativeElement.textContent).toContain('Épargne prévue conservée');
    expect(row.nativeElement.textContent).toContain('+200.00 CHF');
    expect(row.nativeElement.textContent).toContain('Retrait planifié');
    expect(row.nativeElement.textContent).toContain('-500.00 CHF');
    expect(row.nativeElement.textContent).toContain('Effet net ce mois');
    expect(row.nativeElement.textContent).toContain('-300.00 CHF');
    expect(row.nativeElement.textContent).not.toContain('200.00 CHF →');
    expect(
      query(fixture, 'goal-plan-apply-confirm').nativeElement.textContent,
    ).toContain('Planifier le retrait');
  });

  it.each([
    {
      after: 100,
      contribution: '+200.00 CHF → +100.00 CHF',
      net: '+100.00 CHF',
    },
    { after: 0, contribution: '+200.00 CHF → 0.00 CHF', net: '0.00 CHF' },
  ])(
    'recaps a linked withdrawal removal ending at $after without requesting a destination',
    ({ after, contribution, net }) => {
      const { fixture, close } = configureDialog({
        changes: [
          {
            month: 9,
            year: 2026,
            before: -500,
            after,
            contributionAmount: 200,
            hasBudget: true,
            planWithdrawalDestination: 'linked_income',
          },
        ],
        currency: 'CHF',
        locale: 'fr-CH',
        payDayOfMonth: 25,
        verdict: 'Projection mise à jour',
      });

      const contributionRow = query(
        fixture,
        'goal-plan-withdrawal-contribution',
      ).nativeElement.textContent.replace(/\s+/g, ' ');
      const withdrawalRow = query(
        fixture,
        'goal-plan-withdrawal-amount',
      ).nativeElement.textContent.replace(/\s+/g, ' ');
      const netRow = query(fixture, 'goal-plan-withdrawal-net').nativeElement
        .textContent;
      expect(contributionRow).toContain('Épargne prévue');
      expect(contributionRow).not.toContain('conservée');
      expect(contributionRow).toContain(contribution);
      expect(withdrawalRow).toContain('Retrait planifié');
      expect(withdrawalRow).toContain('-500.00 CHF → 0.00 CHF');
      expect(netRow).toContain('Effet net ce mois');
      expect(netRow).toContain(net);
      expect(
        query(fixture, 'goal-plan-withdrawal-conversion').nativeElement
          .textContent,
      ).toContain('La Prévision Revenu liée sera supprimée');
      expect(query(fixture, 'goal-plan-withdrawal-goal-only')).toBeNull();
      expect(query(fixture, 'goal-plan-withdrawal-linked-income')).toBeNull();

      query(fixture, 'goal-plan-apply-confirm').nativeElement.click();
      expect(close).toHaveBeenCalledWith(true);
    },
  );

  it('preserves mixed destinations and limits budget unavailability to its month', () => {
    const { fixture, close } = configureDialog({
      changes: [
        {
          month: 9,
          year: 2026,
          before: -500,
          after: -450,
          contributionAmount: 200,
          hasBudget: true,
          planWithdrawalDestination: 'linked_income',
        },
        {
          month: 10,
          year: 2026,
          before: -300,
          after: -250,
          contributionAmount: 200,
          hasBudget: true,
          planWithdrawalDestination: 'goal_only',
        },
        {
          month: 11,
          year: 2026,
          before: 200,
          after: -150,
          contributionAmount: 200,
          hasBudget: false,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    const linkedOptions = fixture.debugElement.queryAll(
      By.css('[data-testid="goal-plan-withdrawal-linked-income"]'),
    );
    expect(
      linkedOptions.map((option) => option.componentInstance.disabled),
    ).toEqual([false, false, true]);
    expect(
      query(fixture, 'goal-plan-apply-confirm').nativeElement.textContent,
    ).toContain('Planifier les retraits');

    query(fixture, 'goal-plan-apply-confirm').nativeElement.click();
    expect(close).toHaveBeenCalledWith([
      { month: 9, year: 2026, destination: 'linked_income' },
      { month: 10, year: 2026, destination: 'goal_only' },
      { month: 11, year: 2026, destination: 'goal_only' },
    ]);
  });

  it('caps non-withdrawal rows while keeping every withdrawal visible and selectable', () => {
    const { fixture } = configureDialog({
      changes: [
        ...Array.from({ length: 6 }, (_, index) => ({
          month: index + 1,
          year: 2027,
          before: 100,
          after: 101 + index,
        })),
        {
          month: 7,
          year: 2027,
          before: 200,
          after: -500,
          contributionAmount: 200,
          hasBudget: true,
        },
        {
          month: 8,
          year: 2027,
          before: 200,
          after: -600,
          contributionAmount: 200,
          hasBudget: true,
        },
      ],
      currency: 'CHF',
      locale: 'fr-CH',
      payDayOfMonth: 25,
      verdict: 'Projection mise à jour',
    });

    const recap = query(fixture, 'goal-plan-apply-diff').nativeElement;
    expect(recap.textContent).not.toContain('106.00 CHF');
    expect(recap.textContent).toContain('et 1 autre');
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-withdrawal-breakdown"]'),
      ),
    ).toHaveLength(2);
    expect(
      fixture.debugElement.queryAll(
        By.css('[data-testid="goal-plan-withdrawal-linked-income"]'),
      ),
    ).toHaveLength(2);
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
    ).toContain('Réalise-la : le Réel créé sera automatiquement pointé.');
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

    expect(close).toHaveBeenCalledWith([
      { month: 9, year: 2026, destination: 'linked_income' },
    ]);
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
