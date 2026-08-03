import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { setTestInput } from '@app/testing/signal-test-utils';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { TagStore } from '@core/tag';
import { UserSettingsStore } from '@core/user-settings';
import { FinancialKindDirective } from '@ui/financial-kind';
import type {
  BudgetLineTableItem,
  TransactionTableItem,
} from '../../../view-models/table-items.view-model';
import { NameCell } from './name-cell';

const linkedLine: BudgetLineTableItem = {
  data: createMockBudgetLine({
    id: 'line-1',
    name: 'Projet vacances',
    kind: 'saving',
    savingsGoalId: 'goal-1',
  }),
  metadata: {
    itemType: 'budget_line',
    cumulativeBalance: 0,
    kindIcon: 'savings',
    allocationLabel: 'Ajouter une épargne',
    displayName: 'Projet vacances',
  },
};

describe('NameCell', () => {
  let fixture: ComponentFixture<NameCell>;
  let component: NameCell;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NameCell, NoopAnimationsModule],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: UserSettingsStore, useValue: { currency: signal('CHF') } },
        {
          provide: TagStore,
          useValue: { resolveNames: vi.fn().mockReturnValue([]) },
        },
      ],
    }).overrideDirective(FinancialKindDirective, { set: { host: {} } });

    fixture = TestBed.createComponent(NameCell);
    component = fixture.componentInstance;
    setTestInput(component.line, linkedLine);
  });

  it('shows the current name and reacts to a cached rename', async () => {
    setTestInput(
      component.savingsGoalNameById,
      new Map([['goal-1', 'Vacances']]),
    );
    fixture.detectChanges();

    const affordance = fixture.nativeElement.querySelector(
      '[data-testid="budget-table-linked-goal-line-1"]',
    ) as HTMLElement | null;
    expect(affordance?.textContent).toContain('Vacances');
    expect(affordance?.querySelector('mat-icon')?.textContent?.trim()).toBe(
      'savings',
    );

    setTestInput(
      component.savingsGoalNameById,
      new Map([['goal-1', 'Voyage au Japon']]),
    );
    await fixture.whenStable();
    expect(affordance?.textContent).toContain('Voyage au Japon');
  });

  it('does not render an affordance for an unknown goal id', () => {
    setTestInput(component.savingsGoalNameById, new Map());
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="budget-table-linked-goal-line-1"]',
      ),
    ).toBeNull();
  });

  describe('savings-goal source (PUL-329)', () => {
    const LONG_NAME =
      'Objectif de rénovation complète de la cuisine et de la salle de bain';

    const sourcedIncome = (
      overrides: Partial<{
        sourceSavingsGoalId: string | null;
        sourceSavingsGoalName: string | null;
      }>,
    ): TransactionTableItem => ({
      data: createMockTransaction({
        id: 'tx-1',
        name: 'Apport cuisine',
        kind: 'income',
        ...overrides,
      }),
      metadata: {
        itemType: 'transaction',
        cumulativeBalance: 0,
        kindIcon: 'trending_up',
        allocationLabel: '',
        displayName: 'Apport cuisine',
      },
    });

    it('hands the whole active source down to the shared line', () => {
      setTestInput(
        component.line,
        sourcedIncome({
          sourceSavingsGoalId: 'goal-1',
          sourceSavingsGoalName: LONG_NAME,
        }),
      );
      fixture.detectChanges();

      expect(component.source()).toEqual({ id: 'goal-1', name: LONG_NAME });
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="budget-table-source-goal-tx-1"]',
        ),
      ).not.toBeNull();
    });

    it('reports a deleted goal as broken while keeping its last known name', () => {
      setTestInput(
        component.line,
        sourcedIncome({
          sourceSavingsGoalId: null,
          sourceSavingsGoalName: 'Maison',
        }),
      );
      fixture.detectChanges();

      expect(component.source()).toEqual({ id: null, name: 'Maison' });
    });

    it('renders nothing for an ordinary transaction', () => {
      setTestInput(component.line, sourcedIncome({}));
      fixture.detectChanges();

      expect(component.source()).toBeNull();
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="budget-table-source-goal-tx-1"]',
        ),
      ).toBeNull();
    });
  });
});
