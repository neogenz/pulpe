import { beforeEach, describe, expect, it } from 'vitest';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ReconciliationContext } from 'pulpe-shared';

import {
  createMockBudgetLine,
  createMockTransaction,
} from '@app/testing/mock-factories';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import {
  buildComparison,
  money,
  ReconcileCompareStep,
  type ComparisonInput,
} from './reconcile-compare-step';

const ASSURANCE = createMockBudgetLine({
  id: 'line-assurance',
  name: 'Assurance',
  amount: 100,
});
const ESSENCE = createMockTransaction({
  id: 'tx-essence',
  name: 'Essence',
  amount: 60,
  transactionDate: '2026-11-18T10:00:00+01:00',
});
const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: true,
  priorCorrection: 0,
  priorItems: [
    {
      id: 'tx-pharmacie',
      source: 'transaction',
      budgetId: 'budget-october',
      name: 'Pharmacie',
      amount: 40,
      kind: 'expense',
      monthsAgo: 1,
      effect: -40,
    },
  ],
};

// Pulpe holds 1 050.00 checked, the accounts 950.00: 100.00 to find.
function input(overrides: Partial<ComparisonInput> = {}): ComparisonInput {
  return {
    onAccountsCents: 95_000,
    realizedBalance: 1050,
    available: 900,
    budgetLines: [ASSURANCE],
    transactions: [ESSENCE],
    context: CONTEXT,
    comparedBefore: null,
    isDismissed: false,
    ...overrides,
  };
}

describe('buildComparison', () => {
  it('should rank the month and last month items that close a gap of 100.00', () => {
    const view = buildComparison(input());

    expect(view.gap).toBe(-100);
    expect(view.screen).toBe('suggestions');
    expect(
      view.suggestions.map(({ name, monthsAgo, settles }) => ({
        name,
        monthsAgo,
        settles,
      })),
    ).toEqual([
      { name: 'Assurance', monthsAgo: 0, settles: true },
      { name: 'Essence', monthsAgo: 0, settles: false },
      { name: 'Pharmacie', monthsAgo: 1, settles: false },
    ]);
    expect(view.suggestions[2]).toMatchObject({
      kind: 'transaction',
      id: 'tx-pharmacie',
    });
    expect(view.othersCount).toBe(0);
  });

  // The link opens the budget on « À pointer », which hides a checked prévision
  // with its movements, and a goal withdrawal once realized: it counts only what shows there.
  it('should count only the items the budget shows under « À pointer »', () => {
    const loyer = createMockBudgetLine({
      id: 'line-loyer',
      name: 'Loyer',
      amount: 100,
      checkedAt: '2026-11-02T10:00:00Z',
    });
    const withdrawal = createMockBudgetLine({
      id: 'line-withdrawal',
      name: 'Retrait voyage',
      amount: 500,
      kind: 'income',
      sourceSavingsGoalId: 'goal-1',
    });
    const view = buildComparison(
      input({
        // Accounts above Pulpe: no expense is suggested, every item is an « other ».
        onAccountsCents: 120_000,
        budgetLines: [ASSURANCE, loyer, withdrawal],
        transactions: [
          ESSENCE,
          createMockTransaction({
            id: 'tx-loyer',
            budgetLineId: loyer.id,
            name: 'Loyer',
            amount: 120,
          }),
          createMockTransaction({
            id: 'tx-withdrawal',
            budgetLineId: withdrawal.id,
            name: 'Retrait voyage',
            amount: 500,
            kind: 'income',
            checkedAt: '2026-11-03T10:00:00Z',
          }),
        ],
      }),
    );

    expect(view.suggestions).toEqual([]);
    // Assurance and Essence: the 120 on the checked Loyer and the realized withdrawal stay hidden.
    expect(view.othersCount).toBe(2);
  });

  it('should keep the figure before the first check and rank what is left', () => {
    const view = buildComparison(
      input({
        realizedBalance: 990,
        transactions: [{ ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' }],
        comparedBefore: 1050,
      }),
    );

    expect(view.gap).toBe(-40);
    expect(view.compared).toBe(990);
    expect(view.comparedBefore).toBe(1050);
    expect(
      view.suggestions.map(({ name, settles }) => [name, settles]),
    ).toEqual([['Pharmacie', true]]);
  });

  // Same rule as iOS `found(gap:totalCents:)`: accounts 1 000.00, Pulpe 950.00 before the checks.
  it.each([
    { compared: 1100, found: 0 }, // the gap grew from 50.00 to 100.00
    { compared: 980, found: 30 }, // the gap shrank from 50.00 to 20.00
  ])(
    'should count as found only what brought the gap nearer zero ($compared => $found)',
    ({ compared, found }) => {
      const view = buildComparison(
        input({
          onAccountsCents: 100_000,
          realizedBalance: compared,
          comparedBefore: 950,
        }),
      );

      expect(view.comparedBefore).toBe(950);
      expect(view.found).toBe(found);
    },
  );

  it('should rank a movement that closes the gap without highlighting an amount other than the gap', () => {
    const courses = createMockBudgetLine({
      id: 'line-courses',
      name: 'Courses',
      amount: 100,
      checkedAt: '2026-11-02T10:00:00Z',
    });
    const migros = createMockTransaction({
      id: 'tx-migros',
      name: 'Migros',
      amount: 120,
      budgetLineId: 'line-courses',
    });
    const view = buildComparison(
      input({
        onAccountsCents: 103_000,
        budgetLines: [courses],
        transactions: [migros],
        context: { ...CONTEXT, priorItems: [] },
      }),
    );

    expect(view.gap).toBe(-20);
    expect(
      view.suggestions.map(({ name, settles }) => [name, settles]),
    ).toEqual([['Migros', false]]);
  });

  it('should add the prior correction and the starting amount to the figure', () => {
    const view = buildComparison(
      input({
        context: { ...CONTEXT, priorCorrection: 40, startingAmount: 10 },
      }),
    );

    expect(view.compared).toBe(1100);
  });

  it('should end on matched with what is still planned and the month to spend', () => {
    const view = buildComparison(input({ onAccountsCents: 105_000 }));

    expect(view.screen).toBe('matched');
    expect(view.matched).toEqual({
      stillPlanned: -150,
      beforePulpe: 0,
      remaining: 900,
    });
  });

  it('should pick the small or the large gap once the suggestions are dismissed', () => {
    const small = buildComparison(
      input({ onAccountsCents: 104_760, isDismissed: true }),
    );
    const large = buildComparison(
      input({ onAccountsCents: 93_000, isDismissed: true }),
    );

    expect(small.screen).toBe('smallGap');
    expect(small.note).toEqual({ before: 900, after: 897.6 });
    expect(large.screen).toBe('largeGap');
    expect(large.note).toEqual({ before: 900, after: 780 });
  });
});

describe('ReconcileCompareStep', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
        { provide: LOCALE_ID, useValue: 'fr-CH' },
      ],
    });
  });

  async function render(
    comparisonInput: ComparisonInput,
    inputs: Record<string, unknown> = {},
  ) {
    const fixture = TestBed.createComponent(ReconcileCompareStep);
    fixture.componentRef.setInput(
      'comparison',
      buildComparison(comparisonInput),
    );
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput('hasOwe', false);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (id: string) =>
      Array.from(host.querySelectorAll(`[data-testid="${id}"]`), (element) =>
        element.textContent?.replace(/[ \n\t]+/g, ' ').trim(),
      );
    return { host, text };
  }

  it('should title the gap and name where each suggestion comes from', async () => {
    const { host, text } = await render(input());

    expect(text('reconcile-step-heading')).toEqual([
      'Tes comptes ont 100.00 CHF de moins que Pulpe',
    ]);
    expect(text('reconcile-suggestion-detail')).toEqual([
      'Prévue ce mois',
      '18 nov.',
      'Mois dernier',
    ]);
    const amounts = host.querySelectorAll(
      '[data-testid="reconcile-suggestion-amount"]',
    );
    expect(amounts[0].classList).toContain('bg-primary-container');
    expect(amounts[1].classList).not.toContain('bg-primary-container');
    expect(host.querySelector('[data-testid="reconcile-found"]')).toBeNull();
    expect(host.textContent).toContain(
      "Coche les dépenses que tu vois dans l'app de ta banque.",
    );
  });

  // « Masquer les montants » blurs every `.ph-no-capture`: the words must stay readable.
  it('should mask the amount of the heading, never its words', async () => {
    const gap = await render(input());
    const masked = (host: HTMLElement) =>
      Array.from(
        host.querySelectorAll(
          '[data-testid="reconcile-step-heading"] .ph-no-capture',
        ),
        (element) => element.textContent,
      );

    expect(masked(gap.host)).toEqual([money(100, 'CHF')]);
    expect(
      gap.host.querySelector('[data-testid="reconcile-step-heading"]')
        ?.classList,
    ).not.toContain('ph-no-capture');

    const matched = await render(input({ onAccountsCents: 105_000 }));
    expect(masked(matched.host)).toEqual([]);
  });

  // A keyboard user keeps their place: the checked row goes disabled, then leaves.
  it('should hand the focus to the next suggestion once a check settles, else to the verdict', async () => {
    const fixture = TestBed.createComponent(ReconcileCompareStep);
    fixture.componentRef.setInput('comparison', buildComparison(input()));
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput('hasOwe', false);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async (comparisonInput: ComparisonInput) => {
      fixture.componentRef.setInput('checkingId', 'tx-essence');
      await fixture.whenStable();
      fixture.componentRef.setInput(
        'comparison',
        buildComparison(comparisonInput),
      );
      fixture.componentRef.setInput('checkingId', null);
      await fixture.whenStable();
    };
    const suggestion = (name: string) =>
      Array.from(
        host.querySelectorAll<HTMLElement>(
          '[data-testid="reconcile-suggestion"]',
        ),
      ).find((row) => row.textContent?.includes(name));

    suggestion('Essence')?.click();
    await settle(
      input({
        realizedBalance: 990,
        transactions: [{ ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' }],
        comparedBefore: 1050,
      }),
    );
    expect(document.activeElement).toBe(suggestion('Pharmacie'));

    suggestion('Pharmacie')?.click();
    await settle(input({ onAccountsCents: 105_000 }));
    expect(document.activeElement?.getAttribute('data-testid')).toBe(
      'reconcile-step-heading',
    );
  });

  // posthog-privacy: wrap the amount, never the label or the sentence around it.
  it('should mask each amount of step 2, never its labels or sentences', async () => {
    const masked = (host: HTMLElement, scope: string) =>
      Array.from(
        host.querySelectorAll(`[data-testid="${scope}"] .ph-no-capture`),
        (element) => element.textContent?.trim(),
      );
    const unmasked = (host: HTMLElement, selector: string) =>
      Array.from(host.querySelectorAll(selector)).every(
        (element) => element.closest('.ph-no-capture') === null,
      );

    const figures = await render(
      input({ realizedBalance: 990, transactions: [], comparedBefore: 1050 }),
    );
    expect(masked(figures.host, 'reconcile-figures')).toEqual(
      [950, 1050, 990, 60].map((amount) => money(amount, 'CHF')),
    );
    expect(unmasked(figures.host, '[data-testid="reconcile-figures"] dt')).toBe(
      true,
    );
    expect(unmasked(figures.host, '[data-testid="reconcile-found"]')).toBe(
      true,
    );

    const matched = await render(input({ onAccountsCents: 105_000 }));
    expect(masked(matched.host, 'reconcile-matched')).toHaveLength(2);
    expect(unmasked(matched.host, '[data-testid="reconcile-matched"] dt')).toBe(
      true,
    );

    const large = await render(
      input({ onAccountsCents: 93_000, isDismissed: true }),
    );
    expect(masked(large.host, 'reconcile-large-gap')).toHaveLength(1);
    expect(masked(large.host, 'reconcile-large-gap')[0]).toContain('120.00');
    expect(unmasked(large.host, '[data-testid="reconcile-large-gap"]')).toBe(
      true,
    );
  });

  it('should strike the figure before the checks and show what they found', async () => {
    const { text } = await render(
      input({ realizedBalance: 990, transactions: [], comparedBefore: 1050 }),
    );

    expect(text('reconcile-compared-before')).toEqual(['1’050.00 CHF']);
    expect(text('reconcile-found')).toEqual(['60.00 CHF trouvés']);
    expect(text('reconcile-step-heading')[0]).toContain('40.00');
  });

  it('should speak of card purchases and offer to remove « Je dois » when one is listed', async () => {
    const { host, text } = await render(input(), {
      hasOwe: true,
      oweTotal: 800,
    });

    expect(text('reconcile-remove-owe-button')).toEqual([
      'Retirer « Je dois 800.00 CHF »',
    ]);
    // Only the amount is masked, inside one inline run: the button's flex
    // layout would otherwise drop the space before it.
    const masked = host.querySelector(
      '[data-testid="reconcile-remove-owe-button"] .ph-no-capture',
    );
    expect(masked?.textContent).toBe(money(800, 'CHF'));
    expect(masked?.parentElement?.textContent).toBe(
      text('reconcile-remove-owe-button')[0],
    );
  });

  it('should title matched alone, with no sentence under it', async () => {
    const { host, text } = await render(input({ onAccountsCents: 105_000 }));

    expect(text('reconcile-step-heading')).toEqual(['Pareil des deux côtés']);
    expect(host.querySelector('[data-testid="reconcile-figures"]')).toBeNull();
    expect(text('reconcile-matched')[0]).toContain('Encore prévu −150.00');
    expect(text('reconcile-matched')[0]).toContain('À dépenser ce mois 900.00');
    expect(text('reconcile-matched')[0]).not.toContain("D'avant Pulpe");
  });

  it('should show what is left to spend in green only when it is not negative', async () => {
    const toSpend = async (available: number) =>
      (await render(input({ onAccountsCents: 105_000, available }))).host
        .querySelector('[data-testid="reconcile-to-spend"]')
        ?.classList.value.split(' ');

    expect(await toSpend(0)).toContain('text-primary');
    const overspent = await toSpend(-50);
    expect(overspent).toContain('text-on-surface');
    expect(overspent).not.toContain('text-primary');
  });

  it('should keep every amount on one line', async () => {
    const { host } = await render(input());

    for (const amount of host.querySelectorAll(
      '[data-testid="reconcile-suggestion-amount"], [data-testid="reconcile-figures"] dd > *, [data-testid="reconcile-figures"] dd',
    )) {
      expect(amount.className + amount.textContent).toMatch(
        /whitespace-nowrap|\u00a0/,
      );
    }
    expect(host.textContent).not.toMatch(/\d CHF/);
  });
});
