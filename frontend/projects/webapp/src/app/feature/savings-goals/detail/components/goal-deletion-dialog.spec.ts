import { provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import localeDE from '@angular/common/locales/de-CH';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type {
  SavingsGoalDeletionCommand,
  SavingsGoalDeletionImpact,
} from 'pulpe-shared';
import { vi } from 'vitest';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { SavingsGoalStore } from '../../services/savings-goals-store';
import {
  GoalDeletionDialog,
  type GoalDeletionDialogData,
} from './goal-deletion-dialog';
// @ts-expect-error Vitest resolves raw assets; the spec tsconfig has no wildcard declaration
import goalDeletionDialogTemplate from './goal-deletion-dialog/goal-deletion-dialog.html?raw';
// @ts-expect-error Vitest resolves raw assets; the spec tsconfig has no wildcard declaration
import goalDeletionDialogStyles from './goal-deletion-dialog/goal-deletion-dialog.scss?raw';

registerLocaleData(localeDE);

const UPDATED_AT = '2026-07-27T10:00:00.000Z';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function makeImpact(budgetCount = 1): SavingsGoalDeletionImpact {
  const templateLine = {
    lineId: uuid(1),
    templateId: uuid(2),
    templateName: 'Mois Type principal',
    name: 'Épargne vacances',
    amount: 200,
    recurrence: 'fixed' as const,
    updatedAt: UPDATED_AT,
  };
  const budgets = Array.from({ length: budgetCount }, (_, index) => {
    const budgetId = uuid(100 + index);
    const lineId = uuid(1_000 + index);
    return {
      budgetId,
      month: (index % 12) + 1,
      year: 2026 + Math.floor(index / 12),
      lines: [
        {
          lineId,
          name: 'Épargne vacances',
          amount: 200,
          recurrence: 'fixed' as const,
          checkedAt: null,
          updatedAt: UPDATED_AT,
          transactions: [
            {
              id: uuid(2_000 + index),
              budgetId,
              budgetLineId: lineId,
              name: 'Virement épargne',
              amount: 180,
              kind: 'saving' as const,
              transactionDate: UPDATED_AT,
              createdAt: UPDATED_AT,
              updatedAt: UPDATED_AT,
              checkedAt: UPDATED_AT,
            },
          ],
        },
      ],
    };
  });

  return {
    goalId: uuid(9),
    summary: {
      templateLineCount: 1,
      templateLineTotal: 200,
      budgetCount,
      budgetLineCount: budgetCount,
      budgetLineTotal: budgetCount * 200,
      transactionCount: budgetCount,
      transactionTotal: budgetCount * 180,
      withdrawalCount: 0,
      withdrawalTotal: 0,
    },
    templateLines: [templateLine],
    budgets,
    withdrawals: [],
    revision: {
      templateLines: [{ id: templateLine.lineId, updatedAt: UPDATED_AT }],
      budgetLines: budgets.map(({ lines }) => ({
        id: lines[0].lineId,
        updatedAt: UPDATED_AT,
      })),
      transactions: budgets.map(({ lines }) => ({
        id: lines[0].transactions[0].id,
        updatedAt: UPDATED_AT,
      })),
    },
  };
}

interface DialogControls {
  selectScope(scope: 'goal_only' | 'goal_and_forecasts'): void;
  deleteTransactions: { set(value: boolean): void };
}

describe('GoalDeletionDialog', () => {
  let fixture: ComponentFixture<GoalDeletionDialog>;
  let component: GoalDeletionDialog;
  let impact: SavingsGoalDeletionImpact;
  const close = vi.fn();
  const fetchDeletionImpact = vi.fn();

  async function createDialog(): Promise<void> {
    TestBed.overrideComponent(GoalDeletionDialog, {
      set: {
        template: goalDeletionDialogTemplate,
        templateUrl: undefined,
        styles: [goalDeletionDialogStyles],
        styleUrl: undefined,
      },
    });
    await TestBed.compileComponents();

    await TestBed.configureTestingModule({
      imports: [GoalDeletionDialog],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            goalId: uuid(9),
            goalName: 'Vacances',
            currency: 'CHF',
            locale: 'fr-CH',
            payDayOfMonth: 25,
          } satisfies GoalDeletionDialogData,
        },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: SavingsGoalStore,
          useValue: { fetchDeletionImpact },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalDeletionDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function query(testId: string) {
    return fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    impact = makeImpact();
    fetchDeletionImpact.mockResolvedValue(impact);
  });

  it('loads a fresh preview and defaults to deleting only the goal', async () => {
    await createDialog();

    query('goal-deletion-confirm').nativeElement.click();

    expect(fetchDeletionImpact).toHaveBeenCalledWith(uuid(9));
    expect(close).toHaveBeenCalledWith({
      mode: 'goal_only',
      revision: impact.revision,
    } satisfies SavingsGoalDeletionCommand);
  });

  it('masks the user-entered goal name in the introduction', async () => {
    await createDialog();

    const introduction = fixture.debugElement.query(
      By.css('mat-dialog-content > p'),
    );
    expect(introduction.nativeElement.textContent).toContain('Vacances');
    expect(introduction.nativeElement.classList).toContain('ph-no-capture');
  });

  it('returns the forecast deletion mode with the displayed revision', async () => {
    await createDialog();
    const controls = component as unknown as DialogControls;

    controls.selectScope('goal_and_forecasts');
    fixture.detectChanges();
    query('goal-deletion-confirm').nativeElement.click();

    expect(close).toHaveBeenCalledWith({
      mode: 'goal_and_forecasts',
      revision: impact.revision,
    } satisfies SavingsGoalDeletionCommand);
    expect(query('goal-deletion-confirm').nativeElement.textContent).toContain(
      "Supprimer l'objectif et les prévisions",
    );
  });

  it('returns the fully destructive mode only after transaction opt-in', async () => {
    await createDialog();
    const controls = component as unknown as DialogControls;

    controls.selectScope('goal_and_forecasts');
    controls.deleteTransactions.set(true);
    fixture.detectChanges();
    query('goal-deletion-confirm').nativeElement.click();

    expect(close).toHaveBeenCalledWith({
      mode: 'goal_forecasts_and_transactions',
      revision: impact.revision,
    } satisfies SavingsGoalDeletionCommand);
    expect(query('goal-deletion-confirm').nativeElement.textContent).toContain(
      'Tout supprimer',
    );
  });

  it('renders every one of 76 budgets inside the keyboard-scrollable region', async () => {
    impact = makeImpact(76);
    fetchDeletionImpact.mockResolvedValue(impact);

    await createDialog();

    const budgets = fixture.debugElement.queryAll(
      By.css('[data-testid="goal-deletion-budget"]'),
    );
    const list = query('goal-deletion-impact-list');
    expect(budgets).toHaveLength(76);
    expect(list.attributes['role']).toBe('region');
    expect(list.attributes['tabindex']).toBe('0');
    expect(list.nativeElement.className).toContain('overflow-y-auto');
  });

  describe('withdrawals kept by every mode (PUL-329)', () => {
    const LONG_NAME =
      'Apport pour la rénovation complète de la cuisine et de la salle de bain';

    beforeEach(() => {
      impact = {
        ...makeImpact(),
        summary: {
          ...makeImpact().summary,
          withdrawalCount: 2,
          withdrawalTotal: 1300,
        },
        withdrawals: [
          {
            transactionId: uuid(3_001),
            budgetId: uuid(100),
            name: LONG_NAME,
            transactionDate: '2026-07-20T10:00:00.000Z',
            amount: 800,
          },
          {
            transactionId: uuid(3_002),
            budgetId: uuid(100),
            name: 'Apport imprévu',
            transactionDate: '2026-06-02T10:00:00.000Z',
            amount: 500,
          },
        ],
      };
      fetchDeletionImpact.mockResolvedValue(impact);
    });

    it('lists the preserved incomes as negative amounts with their total', async () => {
      await createDialog();

      const rows = fixture.debugElement.queryAll(
        By.css('[data-testid="goal-deletion-withdrawal-row"]'),
      );
      expect(rows).toHaveLength(2);
      expect(rows[0].nativeElement.textContent).toContain('-800.00 CHF');
      expect(
        query('goal-deletion-withdrawals-total').nativeElement.textContent,
      ).toContain('-1’300.00 CHF');
      expect(
        query('goal-deletion-withdrawals').nativeElement.textContent,
      ).toContain('restent dans leurs budgets');
    });

    it('keeps the group visible in the fully destructive mode without an opt-in', async () => {
      await createDialog();
      const controls = component as unknown as DialogControls;

      controls.selectScope('goal_and_forecasts');
      controls.deleteTransactions.set(true);
      fixture.detectChanges();

      expect(query('goal-deletion-withdrawals')).toBeTruthy();
      expect(
        fixture.debugElement.queryAll(
          By.css('[data-testid="goal-deletion-withdrawals"] mat-checkbox'),
        ),
      ).toHaveLength(0);
    });

    it('wraps a very long income name instead of truncating it', async () => {
      await createDialog();

      const name = fixture.debugElement.query(
        By.css('[data-testid="goal-deletion-withdrawal-row"] .break-words'),
      );
      expect(name.nativeElement.textContent).toContain(LONG_NAME);
      expect(name.nativeElement.className).not.toContain('truncate');
    });
  });

  it('shows a retry state without enabling deletion when preview loading fails', async () => {
    fetchDeletionImpact
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(impact);

    await createDialog();

    expect(query('goal-deletion-error')).toBeTruthy();
    expect(query('goal-deletion-confirm').nativeElement.disabled).toBe(true);

    query('goal-deletion-retry').nativeElement.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fetchDeletionImpact).toHaveBeenCalledTimes(2);
    expect(query('goal-deletion-summary')).toBeTruthy();
    expect(query('goal-deletion-confirm').nativeElement.disabled).toBe(false);
  });
});
