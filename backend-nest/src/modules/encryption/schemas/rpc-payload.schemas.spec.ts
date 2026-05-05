import { describe, it, expect } from 'bun:test';
import {
  rekeyBudgetLineRpcPayloadSchema,
  rekeyBudgetLinesRpcPayloadSchema,
  rekeyMonthlyBudgetRpcPayloadSchema,
  rekeyMonthlyBudgetsRpcPayloadSchema,
  rekeySavingsGoalRpcPayloadSchema,
  rekeySavingsGoalsRpcPayloadSchema,
  rekeyTemplateLineRpcPayloadSchema,
  rekeyTemplateLinesRpcPayloadSchema,
  rekeyTransactionRpcPayloadSchema,
  rekeyTransactionsRpcPayloadSchema,
} from './rpc-payload.schemas';

const VALID_CIPHERTEXT =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
const VALID_UUID = '8a0f6c80-1234-4e5f-89ab-111111111111';

describe('rekeyBudgetLineRpcPayloadSchema', () => {
  it('should accept a valid item with both ciphertexts', () => {
    const payload = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: VALID_CIPHERTEXT,
    };

    const result = rekeyBudgetLineRpcPayloadSchema.parse(payload);

    expect(result).toEqual(payload);
  });

  it('should accept null amounts (columns are nullable in DB)', () => {
    const payload = {
      id: VALID_UUID,
      amount: null,
      original_amount: null,
    };

    const result = rekeyBudgetLineRpcPayloadSchema.parse(payload);

    expect(result.amount).toBeNull();
    expect(result.original_amount).toBeNull();
  });

  it('should reject extra keys (typo would silently become NULL in SQL)', () => {
    const forged = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: VALID_CIPHERTEXT,
      ammount: VALID_CIPHERTEXT,
    };

    expect(() => rekeyBudgetLineRpcPayloadSchema.parse(forged)).toThrow();
  });

  it('should reject non-uuid id', () => {
    const bad = {
      id: 'not-a-uuid',
      amount: VALID_CIPHERTEXT,
      original_amount: VALID_CIPHERTEXT,
    };

    expect(() => rekeyBudgetLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject empty ciphertext string', () => {
    const bad = {
      id: VALID_UUID,
      amount: '',
      original_amount: VALID_CIPHERTEXT,
    };

    expect(() => rekeyBudgetLineRpcPayloadSchema.parse(bad)).toThrow();
  });

  it('should reject plaintext numeric amount', () => {
    const bad = {
      id: VALID_UUID,
      amount: 1500,
      original_amount: null,
    };

    expect(() => rekeyBudgetLineRpcPayloadSchema.parse(bad)).toThrow();
  });
});

describe('rekeyBudgetLinesRpcPayloadSchema', () => {
  it('should accept an empty list', () => {
    const result = rekeyBudgetLinesRpcPayloadSchema.parse([]);

    expect(result).toEqual([]);
  });

  it('should reject when any item has extras', () => {
    const list = [
      {
        id: VALID_UUID,
        amount: VALID_CIPHERTEXT,
        original_amount: null,
        user_id: 'attacker',
      },
    ];

    expect(() => rekeyBudgetLinesRpcPayloadSchema.parse(list)).toThrow();
  });
});

describe('rekeyTransactionRpcPayloadSchema', () => {
  it('should accept a valid item', () => {
    const payload = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: null,
    };

    expect(rekeyTransactionRpcPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('should reject extra keys', () => {
    const forged = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: null,
      budget_id: 'attacker',
    };

    expect(() => rekeyTransactionRpcPayloadSchema.parse(forged)).toThrow();
  });
});

describe('rekeyTransactionsRpcPayloadSchema', () => {
  it('should accept an empty list', () => {
    expect(rekeyTransactionsRpcPayloadSchema.parse([])).toEqual([]);
  });
});

describe('rekeyTemplateLineRpcPayloadSchema', () => {
  it('should accept a valid item', () => {
    const payload = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: VALID_CIPHERTEXT,
    };

    expect(rekeyTemplateLineRpcPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('should reject extra keys', () => {
    const forged = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: null,
      template_id: 'attacker',
    };

    expect(() => rekeyTemplateLineRpcPayloadSchema.parse(forged)).toThrow();
  });
});

describe('rekeyTemplateLinesRpcPayloadSchema', () => {
  it('should accept an empty list', () => {
    expect(rekeyTemplateLinesRpcPayloadSchema.parse([])).toEqual([]);
  });
});

describe('rekeySavingsGoalRpcPayloadSchema', () => {
  it('should accept a valid item with target_amount fields', () => {
    const payload = {
      id: VALID_UUID,
      target_amount: VALID_CIPHERTEXT,
      original_target_amount: null,
    };

    expect(rekeySavingsGoalRpcPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('should reject use of amount key (wrong field name for savings_goal)', () => {
    const forged = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
      original_amount: null,
    };

    expect(() => rekeySavingsGoalRpcPayloadSchema.parse(forged)).toThrow();
  });

  it('should reject extra keys', () => {
    const forged = {
      id: VALID_UUID,
      target_amount: VALID_CIPHERTEXT,
      original_target_amount: null,
      user_id: 'attacker',
    };

    expect(() => rekeySavingsGoalRpcPayloadSchema.parse(forged)).toThrow();
  });
});

describe('rekeySavingsGoalsRpcPayloadSchema', () => {
  it('should accept an empty list', () => {
    expect(rekeySavingsGoalsRpcPayloadSchema.parse([])).toEqual([]);
  });
});

describe('rekeyMonthlyBudgetRpcPayloadSchema', () => {
  it('should accept a valid item', () => {
    const payload = {
      id: VALID_UUID,
      ending_balance: VALID_CIPHERTEXT,
    };

    expect(rekeyMonthlyBudgetRpcPayloadSchema.parse(payload)).toEqual(payload);
  });

  it('should accept null ending_balance', () => {
    const payload = {
      id: VALID_UUID,
      ending_balance: null,
    };

    expect(
      rekeyMonthlyBudgetRpcPayloadSchema.parse(payload).ending_balance,
    ).toBeNull();
  });

  it('should reject use of amount key (wrong field name for monthly_budget)', () => {
    const forged = {
      id: VALID_UUID,
      amount: VALID_CIPHERTEXT,
    };

    expect(() => rekeyMonthlyBudgetRpcPayloadSchema.parse(forged)).toThrow();
  });

  it('should reject extra keys', () => {
    const forged = {
      id: VALID_UUID,
      ending_balance: VALID_CIPHERTEXT,
      month: 3,
    };

    expect(() => rekeyMonthlyBudgetRpcPayloadSchema.parse(forged)).toThrow();
  });
});

describe('rekeyMonthlyBudgetsRpcPayloadSchema', () => {
  it('should accept an empty list', () => {
    expect(rekeyMonthlyBudgetsRpcPayloadSchema.parse([])).toEqual([]);
  });
});
