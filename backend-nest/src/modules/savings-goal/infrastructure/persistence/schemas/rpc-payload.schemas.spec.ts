import { describe, it, expect } from 'bun:test';
import {
  applySavingsGoalPlanLineSchema,
  applySavingsGoalPlanLineListSchema,
  PLAN_LINE_CHECKED_RPC_MESSAGE,
  PLAN_LINE_NOT_LINKED_RPC_MESSAGE,
  PLAN_LINE_PAST_RPC_MESSAGE,
} from './rpc-payload.schemas';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

const validLine = {
  budget_line_id: UUID,
  amount: 'AES-cipher-amount',
};

describe('applySavingsGoalPlanLineSchema', () => {
  it('accepts a valid ciphertext line update', () => {
    expect(() => applySavingsGoalPlanLineSchema.parse(validLine)).not.toThrow();
  });

  it('rejects an unknown key (strict — a typo must not silently NULL a column)', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({
        ...validLine,
        savings_goal_id: UUID,
      }),
    ).toThrow();
  });

  it('rejects a non-uuid budget_line_id', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({
        ...validLine,
        budget_line_id: 'not-a-uuid',
      }),
    ).toThrow();
  });

  it('rejects an empty amount ciphertext', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({ ...validLine, amount: '' }),
    ).toThrow();
  });

  it('validates a list of line updates', () => {
    expect(applySavingsGoalPlanLineListSchema.parse([validLine])).toHaveLength(
      1,
    );
  });
});

describe('RPC P0001 message constants', () => {
  // These are pinned verbatim against the SQL RAISEs in migration
  // 20260706120000_apply_savings_goal_plan_pul12 (the SQL↔TS coupling contract).
  it('mirror the exact strings the RPC RAISEs', () => {
    expect(PLAN_LINE_NOT_LINKED_RPC_MESSAGE).toBe('Plan line not linked');
    expect(PLAN_LINE_CHECKED_RPC_MESSAGE).toBe('Plan line already checked');
    expect(PLAN_LINE_PAST_RPC_MESSAGE).toBe('Plan line in past period');
  });
});
