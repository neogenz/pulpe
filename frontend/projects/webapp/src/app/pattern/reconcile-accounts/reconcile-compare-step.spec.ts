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
// Left aside by the default input: a second check of the month closes what Essence leaves.
const PHARMACIE = createMockTransaction({
  id: 'tx-pharmacie',
  name: 'Pharmacie',
  amount: 40,
  transactionDate: '2026-11-19T10:00:00+01:00',
});
const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: true,
  priorCorrection: 0,
  priorItems: [],
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
    realizedBefore: null,
    isDismissed: false,
    payDayOfMonth: null,
    today: new Date(2026, 10, 23),
    ...overrides,
  };
}

// Accounts 6 000.00 above Pulpe: no expense of the month can explain money that came in.
const SIX_THOUSAND_MORE = { onAccountsCents: 705_000 };

describe('buildComparison', () => {
  it('should rank the month items that close a gap of 100.00', () => {
    const view = buildComparison(input());

    expect(view.gap).toBe(-100);
    expect(view.screen).toBe('suggestions');
    expect(
      view.suggestions.map(({ name, source, settles }) => ({
        name,
        source,
        settles,
      })),
    ).toEqual([
      { name: 'Assurance', source: 'budgetLine', settles: true },
      { name: 'Essence', source: 'transaction', settles: false },
    ]);
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
        transactions: [
          { ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' },
          PHARMACIE,
        ],
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
      }),
    );

    expect(view.gap).toBe(-20);
    expect(
      view.suggestions.map(({ name, settles }) => [name, settles]),
    ).toEqual([['Migros', false]]);
  });

  it('should add only the starting amount to the month figure', () => {
    const view = buildComparison(
      input({ context: { ...CONTEXT, startingAmount: 10 } }),
    );

    expect(view).toMatchObject({ compared: 1060, realized: 1050 });
  });

  // Editing the money from before Pulpe moves the figure, not the month's balance.
  it('should strike the realized balance only once a check moved it', () => {
    expect(
      buildComparison(input({ realizedBalance: 990, realizedBefore: 1050 }))
        .realizedBefore,
    ).toBe(1050);
    expect(
      buildComparison(
        input({
          realizedBefore: 1050,
          context: { ...CONTEXT, startingAmount: -40 },
        }),
      ).realizedBefore,
    ).toBeNull();
  });

  it('should tell a saving among the shown suggestions, whatever its source', () => {
    const epargne = createMockBudgetLine({
      id: 'line-epargne',
      name: 'Épargne',
      amount: 100,
      kind: 'saving',
    });
    const pilier = createMockTransaction({
      id: 'tx-pilier',
      name: 'Pilier 3a',
      amount: 40,
      kind: 'saving',
    });
    const movement = buildComparison(
      input({ budgetLines: [], transactions: [pilier] }),
    );

    expect(buildComparison(input()).hasSaving).toBe(false);
    expect(buildComparison(input({ budgetLines: [epargne] })).hasSaving).toBe(
      true,
    );
    // 300.00 would cross the 100.00 gap: not shown, so not spoken of.
    expect(
      buildComparison(input({ budgetLines: [{ ...epargne, amount: 300 }] }))
        .hasSaving,
    ).toBe(false);
    expect(movement.hasSaving).toBe(true);
    expect(movement.suggestions[0]).toMatchObject({
      source: 'transaction',
      kind: 'saving',
    });
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

  // Pay day 25: the period ends on the 24th, so the 23rd leaves 2 days and the 19th leaves 6.
  it('should say the salary may be early only within 5 days of a pay day other than 1', () => {
    const screen = (overrides: Partial<ComparisonInput>) =>
      buildComparison(input({ ...SIX_THOUSAND_MORE, ...overrides }));

    const early = screen({ payDayOfMonth: 25 });
    expect(early.screen).toBe('salaryEarly');
    expect(early.nextPayDay).toBe(25);
    expect(
      screen({ payDayOfMonth: 25, today: new Date(2026, 10, 19) }).screen,
    ).toBe('moreOnAccounts');
    expect(screen({ payDayOfMonth: null }).screen).toBe('moreOnAccounts');
    expect(
      screen({ payDayOfMonth: 1, today: new Date(2026, 10, 28) }).screen,
    ).toBe('moreOnAccounts');
  });

  // Pay day 31: March starts on 28 February, which is also where February ends.
  it('should count to the next period start in February with a pay day of 31', () => {
    const february = (day: number) =>
      buildComparison(
        input({
          ...SIX_THOUSAND_MORE,
          payDayOfMonth: 31,
          today: new Date(2026, 1, day),
        }),
      );

    for (const day of [23, 26]) {
      expect(february(day)).toMatchObject({
        screen: 'salaryEarly',
        nextPayDay: 28,
      });
    }
    expect(february(22).screen).toBe('moreOnAccounts');
    // The 28th is pay day itself: nothing to wait for.
    expect(february(28).screen).toBe('moreOnAccounts');
  });

  it('should ask about money from before Pulpe on a first comparison only', () => {
    const first = { ...CONTEXT, hasCompletedComparison: false };

    expect(
      buildComparison(input({ ...SIX_THOUSAND_MORE, context: first })).screen,
    ).toBe('firstComparison');
    expect(
      buildComparison(
        input({
          ...SIX_THOUSAND_MORE,
          context: { ...first, startingAmount: 3100 },
        }),
      ).screen,
    ).toBe('moreOnAccounts');
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

  it('should ask for incomes when the accounts hold more, and turn the small gap example around', async () => {
    const salaire = createMockBudgetLine({
      id: 'line-salaire',
      name: 'Salaire',
      amount: 100,
      kind: 'income',
    });
    const more = await render(
      input({ onAccountsCents: 115_000, budgetLines: [salaire] }),
    );
    expect(more.host.textContent).toContain(
      "Coche les revenus que tu vois dans l'app de ta banque.",
    );

    const small = await render(
      input({ onAccountsCents: 105_240, isDismissed: true }),
    );
    expect(small.text('reconcile-small-gap')[0]).toContain(
      'Café · payé 3.00 · noté 3.80',
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
        transactions: [
          { ...ESSENCE, checkedAt: '2026-11-20T10:00:00Z' },
          PHARMACIE,
        ],
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
      input({
        realizedBalance: 990,
        transactions: [],
        comparedBefore: 1050,
        realizedBefore: 1050,
      }),
    );
    // The old figure twice: struck on screen, then read out after the new one.
    expect(masked(figures.host, 'reconcile-figures')).toEqual(
      [950, 1050, 990, 1050, 60].map((amount) => money(amount, 'CHF')),
    );
    expect(unmasked(figures.host, '[data-testid="reconcile-figures"] dt')).toBe(
      true,
    );
    expect(unmasked(figures.host, '[data-testid="reconcile-found"]')).toBe(
      true,
    );

    const matched = await render(input({ onAccountsCents: 105_000 }));
    expect(masked(matched.host, 'reconcile-matched')).toHaveLength(3);
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
      input({
        realizedBalance: 990,
        transactions: [],
        comparedBefore: 1050,
        realizedBefore: 1050,
      }),
    );

    expect(text('reconcile-compared-before')).toEqual(['1’050.00 CHF']);
    expect(text('reconcile-found')).toEqual(['60.00 CHF trouvés']);
    expect(text('reconcile-step-heading')[0]).toContain('40.00');
  });

  // A screen reader hears « 990.00 CHF au lieu de 1 050.00 CHF », never two bare amounts.
  it('should read the old figure after the new one, as « au lieu de »', async () => {
    const { host, text } = await render(
      input({
        realizedBalance: 990,
        transactions: [],
        comparedBefore: 1050,
        realizedBefore: 1050,
      }),
    );
    const instead = host.querySelector(
      '[data-testid="reconcile-compared-instead"]',
    );

    expect(
      host
        .querySelector('[data-testid="reconcile-compared-before"]')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
    expect(instead?.classList).toContain('sr-only');
    expect(text('reconcile-compared-instead')).toEqual([
      `au lieu de ${money(1050, 'CHF')}`,
    ]);
    expect(instead?.querySelector('.ph-no-capture')?.textContent).toBe(
      money(1050, 'CHF'),
    );
    expect(
      host
        .querySelector('[data-testid="reconcile-compared"]')
        ?.compareDocumentPosition(instead as Node),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect((await render(input())).text('reconcile-compared-instead')).toEqual(
      [],
    );
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

  // Accounts 4 120.00 = 1 020.00 checked + 3 100.00 from before Pulpe; 700.00 left to spend.
  it('should start the matched card from the accounts figure, unsigned', async () => {
    const { host } = await render(
      input({
        onAccountsCents: 412_000,
        realizedBalance: 1020,
        available: 700,
        context: { ...CONTEXT, startingAmount: 3100 },
      }),
    );

    expect(
      Array.from(
        host.querySelectorAll('[data-testid="reconcile-matched"] > div'),
        (row) => [
          row.querySelector('dt')?.textContent?.trim(),
          row
            .querySelector('dd.ph-no-capture, dd .ph-no-capture')
            ?.textContent?.trim(),
        ],
      ),
    ).toEqual([
      ['Sur tes comptes', money(4120, 'CHF')],
      ['Encore prévu', `−${money(320, 'CHF')}`],
      ["D'avant Pulpe", `−${money(3100, 'CHF')}`],
      ['À dépenser ce mois', money(700, 'CHF')],
    ]);
  });

  it('should speak of savings in the lead when one is suggested, unless a « Je dois » row is listed', async () => {
    const withSaving = input({
      budgetLines: [
        createMockBudgetLine({
          id: 'line-epargne',
          name: 'Épargne',
          amount: 100,
          kind: 'saving',
        }),
      ],
    });

    expect((await render(withSaving)).host.textContent).toContain(
      "Coche les dépenses et l'épargne que tu vois dans l'app de ta banque.",
    );
    const card = await render(withSaving, { hasOwe: true });
    expect(card.host.textContent).toContain(
      'Coche les achats faits avec ta carte.',
    );
    expect(card.host.textContent).not.toContain("l'épargne");
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
  it('should ask whether the gap was there before Pulpe, its amount masked alone', async () => {
    const { host, text } = await render(
      input({
        ...SIX_THOUSAND_MORE,
        context: { ...CONTEXT, hasCompletedComparison: false },
      }),
    );

    expect(text('reconcile-first-comparison')[0]).toContain(
      `Ces ${money(6000, 'CHF')} étaient là avant Pulpe ?`,
    );
    expect(text('reconcile-first-comparison')[0]).toContain(
      'Pulpe ne sait pas combien tu avais sur tes comptes quand tu as commencé.',
    );
    expect(
      Array.from(
        host.querySelectorAll(
          '[data-testid="reconcile-first-comparison"] .ph-no-capture',
        ),
        (element) => element.textContent,
      ),
    ).toEqual([money(6000, 'CHF')]);
  });

  it('should tell when to come back on pay day', async () => {
    const { text } = await render(
      input({ ...SIX_THOUSAND_MORE, payDayOfMonth: 25 }),
    );

    expect(text('reconcile-salary-early')).toEqual([
      'Ton salaire est arrivé en avance ? Reviens comparer le 25, jour de ta paie.',
    ]);
  });

  it('should ask about a card only while no « Je dois » row is listed, and send back to step 1', async () => {
    const fixture = TestBed.createComponent(ReconcileCompareStep);
    fixture.componentRef.setInput(
      'comparison',
      buildComparison(input({ onAccountsCents: 185_000 })),
    );
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput('hasOwe', false);
    let addOwe = 0;
    fixture.componentInstance.addOwe.subscribe(() => (addOwe += 1));
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const card = () =>
      host.querySelector('[data-testid="reconcile-card-question"]');

    expect(card()?.textContent).toContain(
      'Tu as payé par carte de crédit, PayPal ou Klarna ?',
    );
    expect(
      host.querySelector('[data-testid="reconcile-large-gap"]')?.textContent,
    ).toContain('Tu vois +800.00');
    host
      .querySelector<HTMLElement>('[data-testid="reconcile-card-owe-button"]')
      ?.click();
    expect(addOwe).toBe(1);

    fixture.componentRef.setInput('hasOwe', true);
    await fixture.whenStable();
    expect(card()).toBeNull();
  });

  it('should show the money from before Pulpe apart from the figure, and open its editor', async () => {
    const withStart = input({
      onAccountsCents: 410_000,
      realizedBalance: 900,
      context: { ...CONTEXT, startingAmount: 3100 },
    });
    const fixture = TestBed.createComponent(ReconcileCompareStep);
    fixture.componentRef.setInput('comparison', buildComparison(withStart));
    fixture.componentRef.setInput('currency', 'CHF');
    fixture.componentRef.setInput('hasOwe', false);
    let edits = 0;
    fixture.componentInstance.editStartingAmount.subscribe(() => (edits += 1));
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const button = () =>
      host.querySelector<HTMLElement>(
        '[data-testid="reconcile-starting-amount-button"]',
      );

    expect(
      host.querySelector('[data-testid="reconcile-compared"]')?.textContent,
    ).toBe(money(900, 'CHF'));
    // The pencil is an icon ligature: only the words count.
    expect(
      button()?.querySelector('.mdc-button__label')?.textContent?.trim(),
    ).toBe(`+${money(3100, 'CHF')} d'avant Pulpe`);
    // Only the amount is masked: the button stays clickable with amounts hidden.
    expect(button()?.classList).not.toContain('ph-no-capture');
    expect(button()?.querySelector('.ph-no-capture')?.textContent).toBe(
      `+${money(3100, 'CHF')}`,
    );
    button()?.click();
    expect(edits).toBe(1);

    // Matched: the « D'avant Pulpe » row opens it, named by the row's words and amount.
    fixture.componentRef.setInput(
      'comparison',
      buildComparison({ ...withStart, onAccountsCents: 400_000 }),
    );
    await fixture.whenStable();
    expect(button()?.getAttribute('aria-labelledby')).toBe(
      'reconcile-before-pulpe reconcile-before-pulpe-amount',
    );
    expect(
      host.querySelector('#reconcile-before-pulpe-amount')?.textContent,
    ).toBe(`−${money(3100, 'CHF')}`);
    button()?.click();
    expect(edits).toBe(2);
  });
});
