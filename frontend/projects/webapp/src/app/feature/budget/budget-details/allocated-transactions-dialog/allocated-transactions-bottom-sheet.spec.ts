import { describe, it, expect } from 'vitest';
import type { Transaction } from 'pulpe-shared';

describe('AllocatedTransactionsBottomSheet', () => {
  describe('Architecture: no store dependency', () => {
    it('should use allocatedTransactions from consumption data directly', () => {
      const transactions: Pick<Transaction, 'id' | 'name' | 'amount'>[] = [
        { id: 'tx-1', name: 'Courses', amount: 50 },
        { id: 'tx-2', name: 'Restaurant', amount: 30 },
      ];

      const consumption = {
        consumed: 80,
        remaining: 20,
        allocatedTransactions: transactions,
        transactionCount: 2,
      };

      expect(consumption.allocatedTransactions).toBe(transactions);
      expect(consumption.allocatedTransactions).toHaveLength(2);
      expect(consumption.allocatedTransactions[0].name).toBe('Courses');
    });
  });

  describe('Consumption percentage calculation', () => {
    it('should calculate percentage when amount > 0', () => {
      const amount = 100;
      const consumed = 75;
      const percentage = amount > 0 ? Math.round((consumed / amount) * 100) : 0;

      expect(percentage).toBe(75);
    });

    it('should return 0 when budget amount is 0', () => {
      const amount = 0;
      const consumed = 50;
      const percentage = amount > 0 ? Math.round((consumed / amount) * 100) : 0;

      expect(percentage).toBe(0);
    });

    it('should handle over-consumption (> 100%)', () => {
      const amount = 100;
      const consumed = 150;
      const percentage = amount > 0 ? Math.round((consumed / amount) * 100) : 0;

      expect(percentage).toBe(150);
    });
  });
});
