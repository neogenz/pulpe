import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { EncryptionRekeyService } from './encryption-rekey.service';

const TEST_USER_ID = 'user-1';
const OLD_DEK = Buffer.alloc(32, 0xaa);
const NEW_DEK = Buffer.alloc(32, 0xbb);

function createMockEncryptionService() {
  return {
    decryptAmount: mock((ciphertext: string, _dek: Buffer) => {
      if (ciphertext.startsWith('invalid-')) {
        throw new Error('Unable to decrypt with old key');
      }
      const value = Number(ciphertext.replace('enc-', ''));
      return Number.isNaN(value) ? 0 : value;
    }),
    encryptAmount: mock(
      (amount: number, _dek: Buffer) => `re-encrypted-${amount}`,
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
          { id: 'bl-1', amount: 100, amount_encrypted: 'enc-100' },
          { id: 'bl-2', amount: 200, amount_encrypted: 'enc-200' },
        ],
        transaction: overrides?.transactions ?? [
          { id: 'txn-1', amount: 50, amount_encrypted: 'enc-50' },
        ],
        template_line: overrides?.templateLines ?? [
          { id: 'tl-1', amount: 300, amount_encrypted: 'enc-300' },
        ],
        savings_goal: overrides?.savingsGoals ?? [
          {
            id: 'sg-1',
            target_amount: 1000,
            target_amount_encrypted: 'enc-1000',
          },
        ],
        monthly_budget: overrides?.monthlyBudgets ?? [
          {
            id: 'mb-1',
            ending_balance: 500,
            ending_balance_encrypted: 'enc-500',
          },
        ],
      };

      return {
        select: (fields: string) => {
          const failOr = (data: unknown[]) => {
            if (overrides?.fetchError) {
              return Promise.resolve({
                data: null,
                error: overrides.fetchError,
              });
            }
            return Promise.resolve({
              data,
              error: null,
            });
          };

          return {
            eq: (field: string, _value: unknown) => {
              if (table === 'monthly_budget' && field === 'user_id') {
                monthlyBudgetCallCount++;
                if (fields === 'id' && monthlyBudgetCallCount === 1) {
                  return failOr(budgetIds);
                }
                return failOr(tableData[table] ?? []);
              }
              if (
                table === 'template' &&
                field === 'user_id' &&
                fields === 'id'
              ) {
                return failOr(templateIds);
              }
              return failOr(tableData[table] ?? []);
            },
            in: () => failOr(tableData[table] ?? []),
          };
        },
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

describe('EncryptionRekeyService', () => {
  let service: EncryptionRekeyService;
  let mockEncryption: ReturnType<typeof createMockEncryptionService>;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockEncryption = createMockEncryptionService();
    mockSupabase = createMockSupabaseClient();
    service = new EncryptionRekeyService(mockEncryption as any);
  });

  it('should re-encrypt all 5 tables via single atomic RPC call', async () => {
    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      mockSupabase as any,
    );

    // 2 budget_lines + 1 transaction + 1 template_line + 1 savings_goal + 1 monthly_budget = 6
    expect(mockEncryption.decryptAmount).toHaveBeenCalledTimes(6);
    expect(mockEncryption.encryptAmount).toHaveBeenCalledTimes(6);

    const rpcCalls = mockSupabase.getRpcCalls();
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fnName).toBe('rekey_user_encrypted_data');
  });

  it('should send correct JSONB payloads to RPC function', async () => {
    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      mockSupabase as any,
    );

    const params = mockSupabase.getRpcCalls()[0].params as Record<
      string,
      unknown[]
    >;

    expect(params.p_budget_lines).toEqual([
      { id: 'bl-1', amount_encrypted: 're-encrypted-100' },
      { id: 'bl-2', amount_encrypted: 're-encrypted-200' },
    ]);
    expect(params.p_transactions).toEqual([
      { id: 'txn-1', amount_encrypted: 're-encrypted-50' },
    ]);
    expect(params.p_template_lines).toEqual([
      { id: 'tl-1', amount_encrypted: 're-encrypted-300' },
    ]);
    expect(params.p_savings_goals).toEqual([
      { id: 'sg-1', target_amount_encrypted: 're-encrypted-1000' },
    ]);
    expect(params.p_monthly_budgets).toEqual([
      { id: 'mb-1', ending_balance_encrypted: 're-encrypted-500' },
    ]);
  });

  it('should call decryptAmount with oldDek', async () => {
    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      mockSupabase as any,
    );

    for (const call of mockEncryption.decryptAmount.mock.calls) {
      expect(call[1]).toEqual(OLD_DEK);
    }
  });

  it('should call encryptAmount with newDek', async () => {
    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      mockSupabase as any,
    );

    for (const call of mockEncryption.encryptAmount.mock.calls) {
      expect(call[1]).toEqual(NEW_DEK);
    }
  });

  it('should skip tables with no encrypted rows and send empty arrays', async () => {
    const emptySupabase = createMockSupabaseClient({
      budgetLines: [],
      transactions: [],
      templateLines: [],
      savingsGoals: [],
      monthlyBudgets: [],
    });

    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      emptySupabase as any,
    );

    expect(mockEncryption.decryptAmount).not.toHaveBeenCalled();
    expect(mockEncryption.encryptAmount).not.toHaveBeenCalled();

    const params = emptySupabase.getRpcCalls()[0].params as Record<
      string,
      unknown[]
    >;
    expect(params.p_budget_lines).toEqual([]);
    expect(params.p_transactions).toEqual([]);
    expect(params.p_template_lines).toEqual([]);
    expect(params.p_savings_goals).toEqual([]);
    expect(params.p_monthly_budgets).toEqual([]);
  });

  it('should propagate fetch errors from budget ID lookup', async () => {
    const errorSupabase = createMockSupabaseClient({
      fetchError: new Error('DB error'),
    });

    await expect(
      service.reEncryptAllUserData(
        TEST_USER_ID,
        OLD_DEK,
        NEW_DEK,
        errorSupabase as any,
      ),
    ).rejects.toThrow('DB error');
  });

  it('should propagate RPC errors for atomic rollback', async () => {
    const rpcErrorSupabase = createMockSupabaseClient({
      rpcError: new Error('RPC transaction failed'),
    });

    await expect(
      service.reEncryptAllUserData(
        TEST_USER_ID,
        OLD_DEK,
        NEW_DEK,
        rpcErrorSupabase as any,
      ),
    ).rejects.toThrow('RPC transaction failed');
  });

  it('should encrypt plaintext amounts directly when amount_encrypted is null', async () => {
    const nullSupabase = createMockSupabaseClient({
      budgetLines: [
        { id: 'bl-1', amount: 100, amount_encrypted: 'enc-100' },
        { id: 'bl-null', amount: 150, amount_encrypted: null },
      ],
      transactions: [],
      templateLines: [],
      savingsGoals: [],
      monthlyBudgets: [],
    });

    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      nullSupabase as any,
    );

    expect(mockEncryption.decryptAmount).toHaveBeenCalledTimes(1);
    expect(mockEncryption.decryptAmount).toHaveBeenCalledWith(
      'enc-100',
      OLD_DEK,
    );

    const encryptCalls = mockEncryption.encryptAmount.mock.calls as unknown[][];
    const directEncryptCall = encryptCalls.find(
      (call) => call[0] === 150 && call[1] === NEW_DEK,
    );
    expect(directEncryptCall).toBeDefined();

    const params = nullSupabase.getRpcCalls()[0].params as Record<
      string,
      unknown[]
    >;
    expect(params.p_budget_lines).toEqual([
      { id: 'bl-1', amount_encrypted: 're-encrypted-100' },
      { id: 'bl-null', amount_encrypted: 're-encrypted-150' },
    ]);
  });

  it('should skip budget_line and transaction when no budgets exist', async () => {
    const noBudgets = createMockSupabaseClient({
      budgetIds: [],
      savingsGoals: [],
      monthlyBudgets: [],
      templateLines: [],
    });

    await service.reEncryptAllUserData(
      TEST_USER_ID,
      OLD_DEK,
      NEW_DEK,
      noBudgets as any,
    );

    expect(mockEncryption.decryptAmount).not.toHaveBeenCalled();
  });

  it('should fail strictly when encrypted data cannot be decrypted with old key', async () => {
    const strictSupabase = createMockSupabaseClient({
      budgetLines: [
        { id: 'bl-1', amount: 100, amount_encrypted: 'invalid-100' },
      ],
      transactions: [],
      templateLines: [],
      savingsGoals: [],
      monthlyBudgets: [],
    });

    await expect(
      service.reEncryptAllUserData(
        TEST_USER_ID,
        OLD_DEK,
        NEW_DEK,
        strictSupabase as any,
      ),
    ).rejects.toThrow('Unable to decrypt with old key');

    expect(strictSupabase.getRpcCalls()).toHaveLength(0);
  });
});
