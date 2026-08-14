import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { describe, expect, it } from 'vitest';
import { createMockBudgetLine } from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { setTestInput } from '@app/testing/signal-test-utils';
import { createBudgetLineTableItem } from '../view-models/budget-item-data-builder';
import { BudgetActionMenu } from './budget-action-menu';

describe('BudgetActionMenu', () => {
  it('registers its actions with MatMenu keyboard navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetActionMenu],
      providers: [
        provideZonelessChangeDetection(),
        provideAnimationsAsync(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(BudgetActionMenu);
    setTestInput(
      fixture.componentInstance.item,
      createBudgetLineTableItem({
        budgetLine: createMockBudgetLine({
          id: 'line-1',
          kind: 'expense',
          recurrence: 'one_off',
        }),
        transactions: [],
      }),
    );
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(MatMenuHarness);

    await menu.open();

    expect(await menu.getItems()).not.toHaveLength(0);
    expect(document.activeElement?.hasAttribute('mat-menu-item')).toBe(true);
  });
});
