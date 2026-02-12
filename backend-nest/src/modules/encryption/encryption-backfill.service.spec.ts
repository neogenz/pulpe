import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { EncryptionBackfillService } from './encryption-backfill.service';

const TEST_USER_ID = 'user-1';
const DEK = Buffer.alloc(32, 0xcc);

function createMockEncryptionService() {
  return {
    encryptAmount: mock(
      (amount: number, _dek: Buffer) => `encrypted-${amount}`,
    ),
  };
}

function createMockSupabaseClient(overrides?: {
  budgetLines?: unknown[];
  transactions?: unknown[];
  templateLines?: unknown[];
  savingsGoals?: unknown[];
  monthlyBudgets?: unknown[];
  budgetIds?: unknown[];
  templateIds?: unknown[];
  fetchError?: unknown;
  rpcError?: unknown;
}) {
  const budgetIds = overrides?.budgetIds ?? [
    { id: 'budget-1' },
    { id: 'budget-2' },
  ];
  const templateIds = overrides?.templateIds ?? [{ id: 'template-1' }];

  const rpcCalls: Array<{ fnName: string; params: unknown }> = [];
  let monthlyBudgetCallCount = 0;

  const client = {
    getRpcCalls: () => rpcCalls,
    from: (table: string) => {
      const tableData: Record<string, unknown[]> = {
        budget_line: overrides?.budgetLines ?? [
          { id: 'bl-1', amount: 100 },
          { id: 'bl-2', amount: 200 },
        ],
        transaction: overrides?.transactions ?? [{ id: 'txn-1', amount: 50 }],
        template_line: overrides?.templateLines ?? [
          { id: 'tl-1', amount: 300 },
        ],
        savings_goal: overrides?.savingsGoals ?? [
          { id: 'sg-1', target_amount: 1000 },
        ],
        monthly_budget: overrides?.monthlyBudgets ?? [
          { id: 'mb-1', ending_balance: 500 },
        ],
      };

      return {
        select: (_fields: string) => ({
          eq: (_field: string, _value: unknown) => {
            if (overrides?.fetchError) {
              return Promise.resolve({
                data: null,
                error: overrides.fetchError,
              });
            }
            if (table === 'monthly_budget' && _field === 'user_id') {
              monthlyBudgetCallCount++;
              if (monthlyBudgetCallCount === 1) {
                return Promise.resolve({ data: budgetIds, error: null });
              }
              return {
                is: () =>
                  Promise.resolve({
                    data: tableData[table] ?? [],
                    error: null,
                  }),
              };
            }
            if (table === 'template' && _field === 'user_id') {
              return Promise.resolve({ data: templateIds, error: null });
            }
            return {
              is: () =>
                Promise.resolve({
                  data: tableData[table] ?? [],
                  error: null,
                }),
            };
          },
          is: (_nf: string, _nv: unknown) => ({
            in: () =>
              Promise.resolve({
                data: tableData[table] ?? [],
                error: null,
              }),
          }),
        }),
      };
    },
    rpc: (fnName: string, params: unknown) => {
      rpcCalls.push({ fnName, params });
      if (overrides?.rpcError) {
        return Promise.resolve({ data: null, error: overrides.rpcError });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return client;
}

describe('EncryptionBackfillService', () => {
  let service: EncryptionBackfillService;
  let mockEncryption: ReturnType<typeof createMockEncryptionService>;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockEncryption = createMockEncryptionService();
    mockSupabase = createMockSupabaseClient();
    service = new EncryptionBackfillService(mockEncryption as never);
  });

  it('should encrypt all 5 tables via single atomic RPC call', async () => {
    await service.backfillUserData(TEST_USER_ID, DEK, mockSupabase as never);

    // 2 budget_lines + 1 transaction + 1 template_line + 1 savings_goal + 1 monthly_budget = 6
    expect(mockEncryption.encryptAmount).toHaveBeenCalledTimes(6);

    const rpcCalls = mockSupabase.getRpcCalls();
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fnName).toBe('rekey_user_encrypted_data');
  });

  it('should send correct JSONB payloads to RPC function', async () => {
    await service.backfillUserData(TEST_USER_ID, DEK, mockSupabase as never);

    const params = mockSupabase.getRpcCalls()[0].params as Record<
      string,
      unknown[]
    >;

    expect(params.p_budget_lines).toEqual([
      { id: 'bl-1', amount_encrypted: 'encrypted-100' },
      { id: 'bl-2', amount_encrypted: 'encrypted-200' },
    ]);
    expect(params.p_transactions).toEqual([
      { id: 'txn-1', amount_encrypted: 'encrypted-50' },
    ]);
    expect(params.p_template_lines).toEqual([
      { id: 'tl-1', amount_encrypted: 'encrypted-300' },
    ]);
    expect(params.p_savings_goals).toEqual([
      { id: 'sg-1', target_amount_encrypted: 'encrypted-1000' },
    ]);
    expect(params.p_monthly_budgets).toEqual([
      { id: 'mb-1', ending_balance_encrypted: 'encrypted-500' },
    ]);
  });

  it('should call encryptAmount with the provided DEK', async () => {
    await service.backfillUserData(TEST_USER_ID, DEK, mockSupabase as never);

    for (const call of mockEncryption.encryptAmount.mock.calls) {
      expect(call[1]).toEqual(DEK);
    }
  });

  it('should early return when no unencrypted data exists', async () => {
    const emptySupabase = createMockSupabaseClient({
      budgetLines: [],
      transactions: [],
      templateLines: [],
      savingsGoals: [],
      monthlyBudgets: [],
    });

    await service.backfillUserData(TEST_USER_ID, DEK, emptySupabase as never);

    expect(mockEncryption.encryptAmount).not.toHaveBeenCalled();
    expect(emptySupabase.getRpcCalls()).toHaveLength(0);
  });

  it('should propagate fetch errors', async () => {
    const errorSupabase = createMockSupabaseClient({
      fetchError: new Error('DB error'),
    });

    await expect(
      service.backfillUserData(TEST_USER_ID, DEK, errorSupabase as never),
    ).rejects.toThrow('DB error');
  });

  it('should propagate RPC errors', async () => {
    const rpcErrorSupabase = createMockSupabaseClient({
      rpcError: new Error('RPC transaction failed'),
    });

    await expect(
      service.backfillUserData(TEST_USER_ID, DEK, rpcErrorSupabase as never),
    ).rejects.toThrow('RPC transaction failed');
  });

  it('should skip budget_line and transaction when no budgets exist', async () => {
    const noBudgets = createMockSupabaseClient({
      budgetIds: [],
      savingsGoals: [],
      monthlyBudgets: [],
      templateLines: [],
    });

    await service.backfillUserData(TEST_USER_ID, DEK, noBudgets as never);

    expect(mockEncryption.encryptAmount).not.toHaveBeenCalled();
  });
});
