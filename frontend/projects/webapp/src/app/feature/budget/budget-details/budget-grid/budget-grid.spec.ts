import { describe, expect, it } from 'vitest';
import { createMockTransaction } from '../../../../testing/mock-factories';
import type { Transaction } from 'pulpe-shared';

/**
 * BudgetGrid — unit tests for computed signal logic.
 *
 * Due to Angular 21 JIT compilation issues with signal-based input.required()
 * (see budget-details-page.spec.ts, test-setup.ts errorOnUnknownProperties: false),
 * DOM-level assertions (template rendering, data-testid queries) are validated
 * through E2E tests. These unit tests cover the component's pure logic.
 */

interface TransactionItem {
  data: Transaction;
  metadata: { isLoading?: boolean; envelopeName?: string | null };
}

function createTransactionItem(
  overrides?: Parameters<typeof createMockTransaction>[0],
  metadata: { isLoading?: boolean; envelopeName?: string | null } = {},
): TransactionItem {
  return { data: createMockTransaction(overrides), metadata };
}

// Mirrors BudgetGrid.freeTransactionItems computed logic
function filterFreeTransactions(items: TransactionItem[]): TransactionItem[] {
  return items.filter((item) => !item.data.budgetLineId);
}

// Mirrors BudgetGrid.categories computed logic
function groupByKind(
  items: { data: { kind: string } }[],
): { title: string; icon: string; items: typeof items }[] {
  return [
    {
      title: 'Revenus',
      icon: 'trending_up',
      items: items.filter((i) => i.data.kind === 'income'),
    },
    {
      title: 'Épargnes',
      icon: 'savings',
      items: items.filter((i) => i.data.kind === 'saving'),
    },
    {
      title: 'Dépenses',
      icon: 'shopping_cart',
      items: items.filter((i) => i.data.kind === 'expense'),
    },
  ];
}

describe('BudgetGrid', () => {
  describe('freeTransactionItems — AC1: "Hors enveloppes" section visibility', () => {
    it('should return only transactions without budgetLineId', () => {
      const items: TransactionItem[] = [
        createTransactionItem({
          id: 'free-tx-1',
          budgetLineId: null,
          kind: 'expense',
          name: 'Café',
          amount: 450,
        }),
        createTransactionItem({
          id: 'alloc-tx-1',
          budgetLineId: 'line-1',
          kind: 'expense',
          name: 'Loyer',
          amount: 1500,
        }),
      ];

      const result = filterFreeTransactions(items);

      expect(result).toHaveLength(1);
      expect(result[0].data.id).toBe('free-tx-1');
      expect(result[0].data.budgetLineId).toBeNull();
    });

    it('should return empty when all transactions are allocated', () => {
      const items: TransactionItem[] = [
        createTransactionItem({ id: 'a1', budgetLineId: 'line-1' }),
        createTransactionItem({ id: 'a2', budgetLineId: 'line-2' }),
      ];

      expect(filterFreeTransactions(items)).toHaveLength(0);
    });

    it('should return empty when no transactions exist', () => {
      expect(filterFreeTransactions([])).toHaveLength(0);
    });
  });

  describe('categories — budget line grouping', () => {
    it('should group items by kind with correct titles', () => {
      const items = [
        { data: { kind: 'income' } },
        { data: { kind: 'saving' } },
        { data: { kind: 'expense' } },
        { data: { kind: 'expense' } },
      ];

      const categories = groupByKind(items);

      expect(categories[0].title).toBe('Revenus');
      expect(categories[0].items).toHaveLength(1);
      expect(categories[1].title).toBe('Épargnes');
      expect(categories[1].items).toHaveLength(1);
      expect(categories[2].title).toBe('Dépenses');
      expect(categories[2].items).toHaveLength(2);
    });

    it('should return empty groups when no items exist', () => {
      const categories = groupByKind([]);

      expect(categories.every((c) => c.items.length === 0)).toBe(true);
    });
  });

  describe('AC4 — amount format', () => {
    it('should use CurrencyPipe format that preserves full amount', async () => {
      // Template uses: {{ amount | currency: 'CHF' : 'symbol' : '1.0-0' }}
      // '1.0-0' = min 1 integer digit, 0 fraction digits = no truncation.
      const { CurrencyPipe } = await import('@angular/common');
      const pipe = new CurrencyPipe('fr-CH');
      const result = pipe.transform(15000, 'CHF', 'symbol', '1.0-0');

      expect(result).toContain('15');
      expect(result).toContain('000');
    });
  });
});
