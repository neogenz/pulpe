import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { DashboardHero } from './dashboard-hero';
import { setTestInput } from '@app/testing/signal-test-utils';
import { registerLocaleData } from '@angular/common';
import localeDE from '@angular/common/locales/de-CH';
import localeFR from '@angular/common/locales/fr';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

registerLocaleData(localeDE);
registerLocaleData(localeFR);

describe('DashboardHero', () => {
  let component: DashboardHero;
  let fixture: ComponentFixture<DashboardHero>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHero],
      providers: [
        provideZonelessChangeDetection(),
        ...provideTranslocoForTest(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHero);
    component = fixture.componentInstance;

    setTestInput(component.available, 0);
    setTestInput(component.expenses, 0);
    setTestInput(component.remaining, 0);
    setTestInput(component.budgetConsumedPercentage, 0);
    setTestInput(component.realizedExpenses, 0);
    setTestInput(component.realizedPercentage, 0);
    setTestInput(component.periodDates, {
      startDate: new Date(),
      endDate: new Date(),
    });
    setTestInput(component.paceStatus, 'on-track');
  });

  // The gloss that used to concede "épargne comprise" retires for good on the
  // first pointing; this line does not, which is the whole reason it exists.
  it('should name what was set aside inside what already left', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.realizedExpenses, 1400);
    setTestInput(component.realizedSavings, 500);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('mis de côté');
    expect(compiled.textContent).toContain('500');
  });

  it('should stay silent about savings in a month that set nothing aside', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.realizedExpenses, 1400);
    setTestInput(component.realizedSavings, 0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'mis de côté',
    );
  });

  // The line prints an aggregation, so anything under half a franc renders as
  // "0" — and "dont 0 CHF mis de côté" is a sentence about money saying none.
  it('should stay silent about savings too small to print', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.realizedExpenses, 1400);
    setTestInput(component.realizedSavings, 0.4);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'mis de côté',
    );
  });

  it('should expose remaining from input', () => {
    setTestInput(component.remaining, 600);

    expect(component.remaining()).toBe(600);
  });

  // The share arrives rounded, so a month 22 CHF short of its ceiling read 100%
  // and the bar dropped its "Disponible" segment and legend key — forty pixels
  // under a headline printing 22 CHF as available to spend.
  it('should keep a sliver of the bar for an amount the headline still shows', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.expenses, 4978);
    setTestInput(component.remaining, 22);
    setTestInput(component.budgetConsumedPercentage, 100);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.segment-free')).not.toBeNull();
    expect(compiled.textContent).toContain('Disponible');
  });

  it('should draw no free share once nothing is left', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.expenses, 5000);
    setTestInput(component.remaining, 0);
    setTestInput(component.budgetConsumedPercentage, 100);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.segment-free'),
    ).toBeNull();
  });

  it('should ignore a sub-cent residual when choosing the hero state', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.remaining, -9e-13);
    fixture.detectChanges();

    expect(component.isPlanOverAvailable()).toBe(false);
    expect(component.isOverBudget()).toBe(false);
    expect(component.isWarning()).toBe(false);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="hero-remaining-amount"]',
      ).textContent,
    ).toContain('0');
  });

  it('should show a real cent-level CHF deficit', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.remaining, -0.05);
    setTestInput(component.paceStatus, 'within-plan');
    fixture.detectChanges();

    expect(component.isPlanOverAvailable()).toBe(true);
    expect(component.isWarning()).toBe(true);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="hero-remaining-amount"]',
      ).textContent,
    ).toContain('0.05');
  });

  it('should localize a one-cent EUR deficit with a comma', () => {
    setTestInput(component.currency, 'EUR');
    setTestInput(component.locale, 'fr-FR');
    setTestInput(component.available, 1000);
    setTestInput(component.remaining, -0.01);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="hero-remaining-amount"]',
      ).textContent,
    ).toContain('0,01');
    expect(fixture.nativeElement.textContent).toContain('€');
  });

  it('should call the month over budget once more has gone out than came in', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1200);
    setTestInput(component.remaining, -200);
    setTestInput(component.budgetConsumedPercentage, 100);
    setTestInput(component.realizedExpenses, 1100);

    expect(component.isOverBudget()).toBe(true);
    expect(component.isWarning()).toBe(false);
  });

  it('should warn on the pace, not on the plan', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 950);
    setTestInput(component.remaining, 50);
    setTestInput(component.budgetConsumedPercentage, 95);
    setTestInput(component.realizedExpenses, 300);
    setTestInput(component.paceStatus, 'tight');

    expect(component.isOverBudget()).toBe(false);
    expect(component.isWarning()).toBe(true);
  });

  // The card used to be amber for anyone who committed more than 90% of their
  // income to a plan, which is every month a disciplined saver has. The colour
  // is read off the ledger now; the plan stays in the legend.
  it('should stay calm on a tight plan the user is respecting', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.expenses, 4700);
    setTestInput(component.remaining, 300);
    setTestInput(component.budgetConsumedPercentage, 94);
    setTestInput(component.realizedExpenses, 900);
    setTestInput(component.paceStatus, 'on-track');

    expect(component.isWarning()).toBe(false);
    expect(component.isOverBudget()).toBe(false);
  });

  // A payday of 27 makes the period called "février" run from 27 January, so
  // on the 27th the card names a month the user is not in yet and every figure
  // on the page is scoped to a window that appeared nowhere. At the default
  // payday the range would only restate the heading.
  describe('period range', () => {
    it('should show the window when the period does not sit on the month', () => {
      setTestInput(component.periodDates, {
        startDate: new Date(2026, 0, 27),
        endDate: new Date(2026, 1, 26),
      });
      fixture.detectChanges();

      // Locale-agnostic: TestBed runs on the default LOCALE_ID, the app on
      // fr-CH. What must hold is that both boundaries reach the card.
      const range = component['periodRange']();
      expect(range).toContain('27');
      expect(range).toContain('26');
      // With the day it is counted against, under the verdict they are both
      // evidence for — not back beside the month heading, where it was a
      // second time fact three rows from the first.
      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '.progress-verdict',
        )?.textContent,
      ).toContain(range);
    });

    // A payday of 16 runs the period called "juin" from 15 May to 14 June, so
    // its midpoint falls on 30 May and naming the card from that midpoint said
    // "mai" over June's figures — in eleven months out of twelve.
    it('should name the month it is showing, not the one its midpoint falls in', () => {
      setTestInput(component.periodDates, {
        startDate: new Date(2026, 4, 15),
        endDate: new Date(2026, 5, 14),
      });
      setTestInput(component.period, { month: 6, year: 2026 });
      fixture.detectChanges();

      const june = new Intl.DateTimeFormat(undefined, {
        month: 'long',
      }).format(new Date(2026, 5, 1));
      const may = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
        new Date(2026, 4, 1),
      );
      expect(component.periodLabel()).toBe(june);
      expect(component.periodLabel()).not.toBe(may);
    });

    it('should stay quiet when the period is the calendar month', () => {
      setTestInput(component.periodDates, {
        startDate: new Date(2026, 7, 1),
        endDate: new Date(2026, 7, 31),
      });
      fixture.detectChanges();

      expect(component['periodRange']()).toBe('');
    });
  });

  // The deficit copy speaks of what is pointed. This branch is reached by a
  // negative remaining, which counts unpointed entries too, so an expense
  // recorded with the toggle off asserted an outflow above a legend reading
  // "Pointé 0".
  //
  // The consumed percentage is pinned at 100 here because that is what the
  // store emits for every negative remaining, and it is the whole reason the
  // deficit block has to return on every path: a version of this test that
  // left the percentage at 0 passed against an input tuple the store cannot
  // produce, while the real one fell through to "presque entièrement engagé".
  it('should name the deficit rather than reassure while nothing is pointed', () => {
    setTestInput(component.available, 5000);
    setTestInput(component.expenses, 5500);
    setTestInput(component.remaining, -500);
    setTestInput(component.budgetConsumedPercentage, 100);
    setTestInput(component.planExceedsAvailable, false);
    setTestInput(component.realizedExpenses, 0);
    setTestInput(component.hasRecordedActivity, true);
    // Nothing was pointed, so no franc counts as unplanned spending and the
    // pace has nothing to judge — which is what puts this month in the branch.
    setTestInput(component.paceStatus, 'within-plan');
    fixture.detectChanges();

    expect(component['statusMessage']()).not.toBe(
      'dashboard.status.outflowBeyondIncome',
    );
    expect(component['statusMessage']()).not.toBe(
      'dashboard.status.almostSpent',
    );
    expect(component['statusMessage']()).toBe(
      'dashboard.status.recordedBeyondIncome',
    );
  });

  // The sentence claims the outflow passed what the month brings in, so that
  // is what it is measured against. Gated on "anything at all was pointed", it
  // also fired for fifty francs pointed against three thousand of income.
  it('should claim an outflow beyond income only once it really passed income', () => {
    setTestInput(component.available, 1000);
    setTestInput(component.expenses, 1400);
    setTestInput(component.remaining, -400);
    setTestInput(component.budgetConsumedPercentage, 100);
    setTestInput(component.planExceedsAvailable, false);
    setTestInput(component.realizedExpenses, 1200);
    setTestInput(component.hasRecordedActivity, true);
    setTestInput(component.paceStatus, 'within-plan');
    fixture.detectChanges();

    expect(component['statusMessage']()).toBe(
      'dashboard.status.outflowBeyondIncome',
    );
  });

  it('should expose budgetConsumedPercentage from input', () => {
    setTestInput(component.budgetConsumedPercentage, 100);

    expect(component.budgetConsumedPercentage()).toBe(100);
  });

  describe('progress legend', () => {
    it('should name the untouched segment without restating the headline amount', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 3491);
      setTestInput(component.remaining, 1309);
      setTestInput(component.budgetConsumedPercentage, 73);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const freeKey = compiled.querySelector('.swatch-free')?.parentElement;
      expect(freeKey?.textContent).toContain('Disponible');
      expect(freeKey?.textContent).not.toMatch(/1.309/);
      expect(
        compiled.querySelector('[data-testid="hero-remaining-amount"]')
          ?.textContent,
      ).toMatch(/1.309/);
    });

    // The first key is the one whose amount a reader most often comes to
    // check, and this gloss is the only place the hero says what it counts.
    it('should define the spent key even when nothing is engaged', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 2400);
      setTestInput(component.realizedExpenses, 2400);
      setTestInput(component.realizedPercentage, 50);
      setTestInput(component.budgetConsumedPercentage, 50);
      fixture.detectChanges();

      const note = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="hero-legend-gloss"]',
      );
      expect(note?.textContent).toContain('Pointé :');
      expect(note?.textContent).not.toContain('Engagé :');
    });

    it('should add the engaged gloss only while that segment is drawn', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 3600);
      setTestInput(component.realizedExpenses, 2400);
      setTestInput(component.realizedPercentage, 50);
      setTestInput(component.budgetConsumedPercentage, 75);
      fixture.detectChanges();

      const note = (fixture.nativeElement as HTMLElement).querySelector(
        '[data-testid="hero-legend-gloss"]',
      );
      expect(note?.textContent).toContain('Pointé :');
      expect(note?.textContent).toContain('Engagé :');
    });

    it('should drop the untouched key once the budget is fully consumed', () => {
      setTestInput(component.available, 4800);
      setTestInput(component.expenses, 4800);
      setTestInput(component.remaining, 0);
      setTestInput(component.budgetConsumedPercentage, 100);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.segment-free')).toBeNull();
      expect(compiled.querySelector('.swatch-free')).toBeNull();
    });
  });

  describe('rollover decomposition', () => {
    it('should caption the amount with its label', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Disponible');
      expect(compiled.textContent).toContain('report du mois dernier');
    });

    it('should hide rollover when rolloverAmount is 0', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 0);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Disponible');
      expect(compiled.textContent).not.toContain('report du mois dernier');
    });

    it('should show negative rollover with minus sign attached to number', () => {
      setTestInput(component.available, 4500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, -500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toContain('report du mois dernier');
      expect(text).not.toContain('- report');
      expect(text).toMatch(/report du mois dernier\s*[−-]500/);
    });

    it('should show positive rollover with plus sign', () => {
      setTestInput(component.available, 5500);
      setTestInput(component.expenses, 1000);
      setTestInput(component.rolloverAmount, 500);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.textContent!;
      expect(text).toMatch(/report du mois dernier\s*\+/);
    });
  });

  describe('pace indicator', () => {
    it('should expose paceStatus from input as on-track', () => {
      setTestInput(component.paceStatus, 'on-track');

      expect(component.paceStatus()).toBe('on-track');
    });

    it('should expose paceStatus from input as tight', () => {
      setTestInput(component.paceStatus, 'tight');

      expect(component.paceStatus()).toBe('tight');
    });

    // The pace verdict is deaf to savings by design, so a month whose only
    // activity was a transfer arrives here as 'unknown'. It used to answer
    // "Rien de saisi ce mois" forty pixels above a legend key reading
    // "Pointé 800" and a bar with a filled segment.
    it('should not claim an empty month when what left the account was foreseen', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.realizedExpenses, 800);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.budgetConsumedPercentage, 60);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Rien de saisi ce mois');
      expect(compiled.textContent).toContain('Tout ce que tu as pointé était');
    });

    // "Rien de saisi ce mois" keyed on realized outflow, which counts neither an
    // income transaction nor an expense recorded and not yet pointed. Either one
    // put that sentence above a Transactions card listing exactly what had been
    // saisi. Nothing has gone out yet either, so the answer is neither of the
    // two the card had.
    it('should not claim an empty month for activity that is not outflow', () => {
      setTestInput(component.available, 5500);
      setTestInput(component.realizedExpenses, 0);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.budgetConsumedPercentage, 60);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      // It says what it measures — outflow — rather than "rien de pointé",
      // which was false beside the forecasts card: pointing the income line
      // leaves realized outflow at zero, so the hero claimed nothing was
      // pointed forty pixels from a list reading "1 sur 12 pointées".
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Rien de saisi ce mois');
      expect(compiled.textContent).not.toContain('Rien de pointé');
      expect(compiled.textContent).toContain(
        'Aucune dépense ni épargne pointée',
      );
    });

    it('should say nothing was recorded when the ledger really is empty', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.realizedExpenses, 0);
      setTestInput(component.hasRecordedActivity, false);
      setTestInput(component.budgetConsumedPercentage, 60);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('Rien de saisi ce mois');
    });

    it('should render the pace verdict when spending outruns the month', () => {
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus vite que le mois');
    });

    // The verdict compares spending to how far the month has run, and how far
    // the month has run appeared nowhere on the card: no date, no day, and the
    // period range prints only for a payday off the 1st. "Tu dépenses plus vite
    // que le mois ne passe" asked the reader to take the second half on trust.
    it('should show how far the month has run beside the verdict', () => {
      setTestInput(component.periodDates, {
        startDate: new Date(2026, 5, 1),
        endDate: new Date(2026, 5, 30),
      });
      setTestInput(component.elapsedDayOfPeriod, 12);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const verdict = (fixture.nativeElement as HTMLElement).querySelector(
        '.progress-verdict',
      );
      expect(verdict?.textContent).toContain('Jour 12 sur 30');
    });

    // Asserted on the sentence rather than on the element: the evidence line
    // now also carries the period window, which is its own fact and stands
    // whether or not a day has been counted.
    it('should stay quiet about the day when none was counted', () => {
      setTestInput(component.elapsedDayOfPeriod, 0);
      fixture.detectChanges();

      expect(
        (fixture.nativeElement as HTMLElement).querySelector(
          '.progress-verdict',
        )?.textContent,
      ).not.toContain('Jour');
    });

    // The reverse of the order this card shipped with. "Presque entièrement
    // engagé" is read off a plan that exists whether or not anything has
    // happened, so it was printed every day of every month and this sentence —
    // the only one about what the user actually did — was never reached.
    it('should let the pace verdict outrank a merely tight plan', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 950);
      setTestInput(component.remaining, 50);
      setTestInput(component.budgetConsumedPercentage, 95);
      setTestInput(component.realizedExpenses, 400);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus vite que le mois');
      expect(compiled.textContent).not.toContain('entièrement engagé');
    });

    // A plan leaving almost nothing free is the one true thing the card has to
    // say once the pace is not alarming.
    it('should fall back to the plan when nothing has gone beyond it', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 950);
      setTestInput(component.remaining, 50);
      setTestInput(component.budgetConsumedPercentage, 95);
      setTestInput(component.realizedExpenses, 0);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('entièrement engagé');
    });

    // The warning used to live inside the 'within-plan' branch alone, so ten
    // francs spent outside an envelope moved the month to 'on-track' and
    // replaced it with "Ton rythme tient." — above a bar still filled to 96%.
    // Spending more turned the warning into reassurance.
    it('should keep warning on a nearly spent plan once a franc goes unplanned', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 4810);
      setTestInput(component.remaining, 190);
      setTestInput(component.budgetConsumedPercentage, 96);
      setTestInput(component.realizedExpenses, 10);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.paceStatus, 'on-track');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('entièrement engagé');
      expect(compiled.textContent).not.toContain('rythme tient');
    });

    // A plan larger than the month's income plus its report. A negative report
    // alone is enough to land here, so it is not an exotic state — it was
    // simply one the card could not reach: it printed the negative at 57px on
    // the calm gradient, captioned "disponible à dépenser", beside a sentence
    // hedging that the budget was "presque" entirely committed.
    it('should not stay calm on a plan that asks for more than the month has', () => {
      setTestInput(component.available, 4000);
      setTestInput(component.expenses, 4500);
      setTestInput(component.remaining, -500);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 900);
      setTestInput(component.planExceedsAvailable, true);
      setTestInput(component.paceStatus, 'on-track');
      fixture.detectChanges();

      expect(component.isOverBudget()).toBe(false);
      expect(component.isWarning()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus que ce que le mois');
      expect(compiled.textContent).not.toContain('presque');
      // The caption follows the sign, and takes the ceiling with it: a
      // shortfall does not come out of a budget of 4'000.
      expect(compiled.textContent).toContain('Il manque');
      expect(compiled.textContent).not.toContain('Disponible à dépenser');
    });

    it('should say the month went over once spending passed what came in', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 1200);
      setTestInput(component.remaining, -200);
      setTestInput(component.realizedExpenses, 1100);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('au-delà de ton budget');
      expect(compiled.textContent).not.toContain('plus vite que le mois');
    });

    // `remaining` counts a free savings transfer as outflow while the plan
    // margin counts only planned lines, so one transfer could open the deficit
    // by itself: red gradient, "ouvre ton budget pour voir ce qui a dépassé",
    // for the money the user had just set aside.
    it('should not call the month over budget when savings opened the deficit', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 5300);
      setTestInput(component.remaining, -300);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 500);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.planExceedsAvailable, false);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      expect(component.isOverBudget()).toBe(false);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('au-delà de ton budget');
      expect(compiled.textContent).not.toContain('Dépensé au-delà');
    });

    // The colour stopped blaming the plan for this deficit; the words did not.
    // Both the caption and the verdict were gated on the deficit alone, so the
    // card told a user whose prévisions fit with 200 to spare that their plan
    // was too big, and sent them to trim one.
    it('should not blame the plan for a deficit the plan did not open', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 5300);
      setTestInput(component.remaining, -300);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 500);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.planExceedsAvailable, false);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('couvrir ton plan');
      expect(compiled.textContent).not.toContain('alléger une prévision');
      expect(compiled.textContent).toContain('équilibrer le mois');
      expect(compiled.textContent).toContain('Ton plan, lui, tient');
      // 500 pointed against 5 000 of income is not an outflow beyond income,
      // and a deficit is never answered with the percentage sentence.
      expect(compiled.textContent).not.toContain('presque entièrement engagé');
      expect(component['statusMessage']()).toBe(
        'dashboard.status.recordedBeyondIncome',
      );
    });

    it('should still blame the plan when the plan really is too big', () => {
      setTestInput(component.available, 4000);
      setTestInput(component.expenses, 4500);
      setTestInput(component.remaining, -500);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 900);
      setTestInput(component.planExceedsAvailable, true);
      setTestInput(component.paceStatus, 'on-track');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('couvrir ton plan');
      expect(compiled.textContent).toContain('alléger une prévision');
      expect(compiled.textContent).not.toContain('équilibrer le mois');
    });

    // The two gates were fixed independently and composed into a falsehood:
    // unpointed spending was enough to buy the confident sentence and not
    // enough to be measured by it.
    it('should not claim everything was foreseen before anything is pointed', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 4400);
      setTestInput(component.remaining, 600);
      setTestInput(component.budgetConsumedPercentage, 88);
      setTestInput(component.realizedExpenses, 0);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).not.toContain('Tout ce que tu as pointé');
      expect(compiled.textContent).not.toContain('Rien de saisi');
      expect(compiled.textContent).toContain(
        'Aucune dépense ni épargne pointée',
      );
    });

    // The caption was gated on the deficit alone, and red is a deficit, so the
    // card blamed the plan directly above a verdict clearing it — and sent the
    // user to trim a prévision in the one state that guarantees every prévision
    // fits.
    it('should not blame the plan in the state that proves the plan fit', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 5500);
      setTestInput(component.remaining, -500);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 5500);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.planExceedsAvailable, false);
      setTestInput(component.paceStatus, 'tight');
      fixture.detectChanges();

      expect(component.isOverBudget()).toBe(true);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('au-delà de ton budget');
      expect(compiled.textContent).toContain('Dépensé au-delà de ton plan');
      expect(compiled.textContent).not.toContain('Il manque');
    });

    // The red state read `realizedExpenses > available`, which pointing alone
    // drives and which counts savings as outflow. A plan 100 over its income
    // therefore went red the moment its lines were pointed, and sent the user
    // to "voir ce qui a dépassé" in a month where nothing had: no envelope
    // exceeded, not one free franc spent, and a third of the total deliberately
    // set aside. The plan is the problem, and the card has a sentence for it.
    it('should blame the plan, not the user, when a pointed plan tips the month over', () => {
      setTestInput(component.available, 5000);
      setTestInput(component.expenses, 5100);
      setTestInput(component.remaining, -100);
      setTestInput(component.budgetConsumedPercentage, 100);
      setTestInput(component.realizedExpenses, 5100);
      setTestInput(component.hasRecordedActivity, true);
      setTestInput(component.planExceedsAvailable, true);
      setTestInput(component.paceStatus, 'within-plan');
      fixture.detectChanges();

      expect(component.isOverBudget()).toBe(false);
      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.textContent).toContain('plus que ce que le mois');
      expect(compiled.textContent).not.toContain('au-delà de ton budget');
    });
  });

  describe('heroClick output', () => {
    it('should emit heroClick when the open-month control is clicked', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      fixture.detectChanges();

      let emitted = false;
      component.heroClick.subscribe(() => (emitted = true));

      const action = fixture.nativeElement.querySelector('.hero-action');
      action.click();

      expect(emitted).toBe(true);
    });

    // The control covers the card, and only reaches that far because it is a
    // direct child of it: an absolute box resolves against its nearest
    // positioned ancestor, and every content row here is relative z-10. Parked
    // inside one — where it first shipped — it covered that row and nothing
    // else, and the whole-card tap the card has always had was quietly gone.
    it('should mount the control as a direct child of the card', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      fixture.detectChanges();

      const container = fixture.nativeElement.querySelector('.hero-container');
      const action = fixture.nativeElement.querySelector('.hero-action');

      expect(action.parentElement).toBe(container);
    });
  });

  describe('accessibility tree', () => {
    it('should keep the month heading and the engaged hint readable', () => {
      setTestInput(component.available, 1000);
      setTestInput(component.expenses, 400);
      // The hint is gated on the segment it defines, so the fixture has to
      // draw one for the paragraph to be in the tree at all.
      setTestInput(component.budgetConsumedPercentage, 40);
      fixture.detectChanges();

      // The card used to be a role="button", and ARIA prunes the roles and
      // names of a button's descendants: this heading and this paragraph were
      // both in the DOM and both invisible to a screen reader.
      const container = fixture.nativeElement.querySelector('.hero-container');
      const heading = fixture.nativeElement.querySelector('h2');

      expect(container.getAttribute('role')).toBeNull();
      expect(container.getAttribute('aria-labelledby')).toBe(heading.id);
      // By testid, not by class: the savings note wears the same class for the
      // same quiet type and sits earlier in the DOM, so querySelector picks it
      // the moment a month has set anything aside. This assertion is about the
      // hint, and it should fail when the hint goes missing — not pass because
      // a different paragraph happened to answer to the same selector.
      expect(
        fixture.nativeElement.querySelector(
          '[data-testid="hero-legend-gloss"]',
        ),
      ).not.toBeNull();
    });
  });
});
