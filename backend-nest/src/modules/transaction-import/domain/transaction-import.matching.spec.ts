import { describe, expect, it } from 'bun:test';
import type {
  AttachableLine,
  ImportCandidate,
} from './transaction-import.entity';
import { planImport, suggestMatch } from './transaction-import.matching';

const line = (overrides: Partial<AttachableLine>): AttachableLine => ({
  id: 'line',
  name: 'Prévision',
  kind: 'expense',
  amount: 100,
  ...overrides,
});

const candidate = (
  overrides: Partial<ImportCandidate> = {},
): ImportCandidate => ({
  position: 1,
  date: '2026-03-10',
  name: 'ORDRE PERMANENT LOYER REGIE DU LAC',
  amount: 1850,
  kind: 'expense',
  fingerprint: 'fp1',
  ...overrides,
});

describe('suggestMatch', () => {
  it('suggests the Prévision whose name is in the bank label', () => {
    expect(
      suggestMatch(candidate(), [
        line({ id: 'rent', name: 'Loyer', amount: 1800 }),
        line({ id: 'food', name: 'Courses', amount: 600 }),
      ]),
    ).toEqual({ budgetLineId: 'rent', reasons: ['kind', 'label'] });
  });

  it('suggests the Prévision with the same amount, to the cent', () => {
    expect(
      suggestMatch(candidate({ name: 'DEBIT 0042', amount: 49.9 }), [
        line({ id: 'phone', name: 'Téléphone', amount: 49.9 }),
        line({ id: 'other', name: 'Autre', amount: 49.95 }),
      ]),
    ).toEqual({ budgetLineId: 'phone', reasons: ['kind', 'amount'] });
  });

  it('lets a label match outweigh an amount match', () => {
    expect(
      suggestMatch(candidate(), [
        line({ id: 'same-amount', name: 'Assurance', amount: 1850 }),
        line({ id: 'rent', name: 'Loyer', amount: 1800 }),
      ])?.budgetLineId,
    ).toBe('rent');
  });

  it('cites both criteria when both hold', () => {
    expect(
      suggestMatch(candidate(), [
        line({ id: 'rent', name: 'Loyer', amount: 1850 }),
      ])?.reasons,
    ).toEqual(['kind', 'amount', 'label']);
  });

  it('suggests nothing between two equally good Prévisions', () => {
    expect(
      suggestMatch(candidate({ name: 'VIREMENT', amount: 200 }), [
        line({ id: 'a', name: 'Cadeaux', amount: 200 }),
        line({ id: 'b', name: 'Sorties', amount: 200 }),
      ]),
    ).toBeNull();
  });

  it('ignores accents, case and short or filler words', () => {
    expect(
      suggestMatch(candidate({ name: 'TWINT CAFE DE LA GARE', amount: 4.8 }), [
        line({ id: 'cafe', name: 'Café de la gare', amount: 50 }),
      ])?.budgetLineId,
    ).toBe('cafe');
    // "de", "la" alone never make a match.
    expect(
      suggestMatch(candidate({ name: 'TWINT CAFE DE LA GARE', amount: 4.8 }), [
        line({ id: 'filler', name: 'De la', amount: 50 }),
      ]),
    ).toBeNull();
  });

  it('only offers Prévisions whose type can carry the operation', () => {
    const lines = [
      line({ id: 'salary', name: 'Salaire', kind: 'income', amount: 1850 }),
      line({ id: 'save', name: 'Épargne', kind: 'saving', amount: 1850 }),
    ];
    expect(suggestMatch(candidate(), lines)?.budgetLineId).toBe('save');
    expect(
      suggestMatch(candidate({ kind: 'income', name: 'SALAIRE MARS' }), lines)
        ?.budgetLineId,
    ).toBe('salary');
  });
});

describe('planImport', () => {
  const lines = [
    line({ id: 'rent', name: 'Loyer', kind: 'expense' }),
    line({ id: 'save', name: 'Épargne', kind: 'saving' }),
    line({ id: 'salary', name: 'Salaire', kind: 'income' }),
  ];
  const candidates = [
    candidate({ position: 1 }),
    candidate({ position: 2, fingerprint: 'fp2' }),
  ];
  const CHECKED_AT = '2026-03-31T10:00:00.000Z';

  it('attaches and checks the decided operations, leaves the rest free', () => {
    const plan = planImport({
      candidates,
      decisions: [{ position: 2, budgetLineId: 'save' }],
      lines,
      checkedAt: CHECKED_AT,
    });

    expect(plan).toEqual({
      planned: [
        {
          ...candidates[0],
          kind: 'expense',
          budgetLineId: null,
          checkedAt: null,
        },
        {
          ...candidates[1],
          kind: 'saving',
          budgetLineId: 'save',
          checkedAt: CHECKED_AT,
        },
      ],
    });
  });

  it.each([
    [{ position: 9, budgetLineId: 'rent' }, 'operation_not_importable'],
    [{ position: 1, budgetLineId: 'gone' }, 'budget_line_unavailable'],
    [{ position: 1, budgetLineId: 'salary' }, 'kind_incompatible'],
  ] as const)('refuses %o (%s)', (decision, problem) => {
    expect(
      planImport({
        candidates,
        decisions: [decision],
        lines,
        checkedAt: CHECKED_AT,
      }),
    ).toEqual({ problem, position: decision.position });
  });
});
