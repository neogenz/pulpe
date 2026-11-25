import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  budgetLineCreateSchema,
  budgetLineSchema,
  budgetLineSpreadCreateSchema,
  budgetLineUpdateSchema,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineSchema,
  templateLineUpdateSchema,
  transactionCreateSchema,
  transactionSchema,
  transactionUpdateSchema,
} from '../schemas.js';

// PUL-378: the account of a movement is optional everywhere, so a client or a
// backend deployed before it keeps working.
const ID = '550e8400-e29b-41d4-a716-446655440000';
const COMPTE_COURANT = '550e8400-e29b-41d4-a716-446655440001';
const NOW = '2026-11-24T10:00:00+00:00';

const writes: [string, z.ZodType, Record<string, unknown>][] = [
  [
    'budget line create',
    budgetLineCreateSchema,
    {
      budgetId: ID,
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
    },
  ],
  ['budget line update', budgetLineUpdateSchema, { id: ID, amount: 1500 }],
  [
    'budget line spread',
    budgetLineSpreadCreateSchema,
    {
      name: 'Pneus',
      kind: 'expense',
      mode: 'perMonth',
      perMonthAmount: 100,
      months: [{ year: 2026, month: 11 }],
    },
  ],
  [
    'transaction create',
    transactionCreateSchema,
    { budgetId: ID, name: 'Restaurant', amount: 80, kind: 'expense' },
  ],
  ['transaction update', transactionUpdateSchema, { amount: 80 }],
  [
    'template line create',
    templateLineCreateSchema,
    {
      templateId: ID,
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    },
  ],
  [
    'template line batch create',
    templateLineCreateWithoutTemplateIdSchema,
    {
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    },
  ],
  ['template line update', templateLineUpdateSchema, { amount: 1500 }],
];

describe('account of a movement on write contracts (PUL-378)', () => {
  it.each(writes)(
    '%s: an old payload without the account parses',
    (_, schema, payload) => {
      const result = schema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('accountId');
    },
  );

  it.each(writes)(
    '%s: carries an account, or null to clear it',
    (_, schema, payload) => {
      expect(
        schema.parse({ ...payload, accountId: COMPTE_COURANT }),
      ).toMatchObject({
        accountId: COMPTE_COURANT,
      });
      expect(schema.parse({ ...payload, accountId: null })).toMatchObject({
        accountId: null,
      });
      expect(
        schema.safeParse({ ...payload, accountId: 'Compte courant' }).success,
      ).toBe(false);
    },
  );
});

describe('account of a movement on responses (PUL-378)', () => {
  const responses: [string, z.ZodType, Record<string, unknown>][] = [
    [
      'budget line',
      budgetLineSchema,
      {
        id: ID,
        budgetId: ID,
        templateLineId: null,
        savingsGoalId: null,
        name: 'Loyer',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        isManuallyAdjusted: false,
        checkedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    [
      'transaction',
      transactionSchema,
      {
        id: ID,
        budgetId: ID,
        budgetLineId: null,
        name: 'Restaurant',
        amount: 80,
        kind: 'expense',
        transactionDate: NOW,
        createdAt: NOW,
        updatedAt: NOW,
        checkedAt: null,
      },
    ],
    [
      'template line',
      templateLineSchema,
      {
        id: ID,
        templateId: ID,
        savingsGoalId: null,
        name: 'Loyer',
        amount: 1500,
        kind: 'expense',
        recurrence: 'fixed',
        description: '',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  ];

  it.each(responses)(
    '%s: a response from an older backend parses, and the account reads back',
    (_, schema, response) => {
      expect(schema.safeParse(response).success).toBe(true);
      expect(
        schema.parse({ ...response, accountId: COMPTE_COURANT }),
      ).toMatchObject({
        accountId: COMPTE_COURANT,
      });
    },
  );
});
