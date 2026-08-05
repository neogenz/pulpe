import { describe, expect, it } from 'vitest';
import {
  budgetLineCreateSchema,
  budgetLineSchema,
  budgetLineUpdateSchema,
} from '../schemas.js';

const GOAL_ID = '123e4567-e89b-12d3-a456-426614174000';
const BUDGET_ID = '223e4567-e89b-12d3-a456-426614174000';
const LINE_ID = '323e4567-e89b-12d3-a456-426614174000';
const OTHER_GOAL_ID = '423e4567-e89b-12d3-a456-426614174000';
const NOW = '2026-08-05T10:00:00+02:00';

const buildCreatePayload = (overrides: Record<string, unknown> = {}) => ({
  budgetId: BUDGET_ID,
  name: 'Retrait vacances',
  amount: 500,
  kind: 'income',
  recurrence: 'one_off',
  sourceSavingsGoalId: GOAL_ID,
  ...overrides,
});

describe('budgetLineCreateSchema planned withdrawal', () => {
  it('should accept an unchecked one-off income drawn from a goal', () => {
    const result = budgetLineCreateSchema.safeParse(buildCreatePayload());

    expect(result.success).toBe(true);
  });

  it.each([
    ['an expense', { kind: 'expense' }],
    ['a saving', { kind: 'saving' }],
    ['a recurring line', { recurrence: 'fixed' }],
    ['an already-checked line', { checkedAt: NOW }],
    ['a contribution to another goal', { savingsGoalId: OTHER_GOAL_ID }],
  ])('should reject %s as a planned withdrawal', (_label, overrides) => {
    const result = budgetLineCreateSchema.safeParse(
      buildCreatePayload(overrides),
    );

    expect(result.success).toBe(false);
  });

  it('should leave an ordinary line untouched by the source rules', () => {
    const result = budgetLineCreateSchema.safeParse({
      budgetId: BUDGET_ID,
      name: 'Loyer',
      amount: 1200,
      kind: 'expense',
      recurrence: 'fixed',
    });

    expect(result.success).toBe(true);
  });

  // Le nom snapshot est figé par le serveur sous le verrou : un nom fourni par
  // le client serait déjà périmé, et le contrat strict le refuse.
  it('should refuse a client-supplied snapshot name', () => {
    const result = budgetLineCreateSchema.safeParse(
      buildCreatePayload({ sourceSavingsGoalName: 'Vacances' }),
    );

    expect(result.success).toBe(false);
  });
});

describe('budgetLineUpdateSchema', () => {
  // Corriger la source, c'est supprimer puis recréer la prévision avant sa
  // réalisation : autoriser le patch ferait diverger le lien de sa transaction.
  it('should refuse to move a forecast to another goal', () => {
    const result = budgetLineUpdateSchema.safeParse({
      id: LINE_ID,
      sourceSavingsGoalId: OTHER_GOAL_ID,
    });

    expect(result.success).toBe(false);
  });

  it('should still accept an ordinary partial update', () => {
    const result = budgetLineUpdateSchema.safeParse({
      id: LINE_ID,
      name: 'Retrait vacances (révisé)',
      amount: 700,
    });

    expect(result.success).toBe(true);
  });
});

describe('budgetLineSchema source states', () => {
  const buildLine = (overrides: Record<string, unknown> = {}) => ({
    id: LINE_ID,
    budgetId: BUDGET_ID,
    templateLineId: null,
    savingsGoalId: null,
    name: 'Retrait vacances',
    amount: 500,
    kind: 'income',
    recurrence: 'one_off',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });

  it.each([
    ['ordinary', { sourceSavingsGoalId: null, sourceSavingsGoalName: null }],
    [
      'active',
      { sourceSavingsGoalId: GOAL_ID, sourceSavingsGoalName: 'Vacances' },
    ],
    [
      'broken after the goal was deleted',
      { sourceSavingsGoalId: null, sourceSavingsGoalName: 'Vacances' },
    ],
  ])('should read a %s source link', (_label, overrides) => {
    const result = budgetLineSchema.safeParse(buildLine(overrides));

    expect(result.success).toBe(true);
  });
});
