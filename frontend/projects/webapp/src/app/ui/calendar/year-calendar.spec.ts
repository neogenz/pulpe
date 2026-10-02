import { TestBed } from '@angular/core/testing';
import { provideTranslocoForTest } from '@app/testing/transloco-testing';
import { getBudgetPeriodForDate } from 'pulpe-shared';
import { YearCalendar } from './year-calendar';
import { type CalendarMonth, type MonthTileLabels } from './calendar-types';

const labels: MonthTileLabels = {
  current: 'Actuel',
  available: 'Disponible',
  create: 'Créer',
  availableSuffixAriaLabel: 'disponible',
  createBudgetAriaLabel: 'créer un budget',
};

function createCalendar(
  months: CalendarMonth[],
  currentDate: { month: number; year: number },
) {
  const fixture = TestBed.createComponent(YearCalendar);
  fixture.componentRef.setInput('labels', labels);
  fixture.componentRef.setInput('currentDate', currentDate);
  fixture.componentRef.setInput('calendarYear', {
    year: months[0].year,
    months,
  });
  return fixture;
}

function monthFor(year: number, month: number): CalendarMonth {
  return {
    id: `${year}-${month}`,
    year,
    month,
    displayName: `Month ${month}`,
    hasContent: true,
    value: 100,
  };
}

describe('YearCalendar budget period classification', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [YearCalendar],
      providers: [...provideTranslocoForTest()],
    }),
  );
  afterEach(() => vi.useRealTimers());

  it('should keep the active previous-calendar-month budget fully visible before payday', async () => {
    vi.setSystemTime(new Date(2026, 7, 4, 12));
    const fixture = createCalendar([monthFor(2026, 7)], {
      month: 7,
      year: 2026,
    });
    await fixture.whenStable();

    const tile: HTMLElement =
      fixture.nativeElement.querySelector('pulpe-month-tile');
    expect(tile.textContent).toContain('Actuel');
    expect(tile.classList.contains('ring-2')).toBe(true);
    expect(tile.classList.contains('opacity-60')).toBe(false);
  });

  it.each<[number, number, number, number | null, number, number]>([
    [2026, 8, 4, 5, 2026, 7],
    [2026, 8, 5, 5, 2026, 8],
    [2026, 8, 14, 15, 2026, 7],
    [2026, 8, 15, 15, 2026, 8],
    [2026, 8, 15, 16, 2026, 8],
    [2026, 8, 16, 16, 2026, 9],
    [2026, 8, 24, 25, 2026, 8],
    [2026, 8, 25, 25, 2026, 9],
    [2027, 1, 4, 5, 2026, 12],
    [2026, 12, 25, 25, 2027, 1],
    [2026, 8, 4, null, 2026, 8],
    [2026, 8, 4, 1, 2026, 8],
  ])(
    'should classify rendered budgets by payday period on %i-%i-%i with payday %s',
    async (year, month, day, payDay, activeYear, activeMonth) => {
      const now = new Date(year, month - 1, day, 12);
      vi.setSystemTime(now);
      const current = getBudgetPeriodForDate(now, payDay);
      expect(current).toEqual({ year: activeYear, month: activeMonth });

      for (const offset of [-1, 0, 1]) {
        const date = new Date(activeYear, activeMonth - 1 + offset, 1);
        const fixture = createCalendar(
          [monthFor(date.getFullYear(), date.getMonth() + 1)],
          current,
        );
        await fixture.whenStable();
        const tile: HTMLElement =
          fixture.nativeElement.querySelector('pulpe-month-tile');
        expect(tile.classList.contains('opacity-60')).toBe(offset < 0);
        expect(tile.classList.contains('ring-2')).toBe(offset === 0);
        expect(tile.textContent?.includes('Actuel')).toBe(offset === 0);
      }
    },
  );

  it('should update opacity and the current badge when the period changes', async () => {
    const fixture = createCalendar([monthFor(2026, 7), monthFor(2026, 8)], {
      year: 2026,
      month: 7,
    });
    await fixture.whenStable();
    const tiles: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('pulpe-month-tile');
    expect(tiles[0].classList.contains('opacity-60')).toBe(false);
    expect(tiles[0].textContent).toContain('Actuel');

    fixture.componentRef.setInput('currentDate', { year: 2026, month: 8 });
    await fixture.whenStable();
    expect(tiles[0].classList.contains('opacity-60')).toBe(true);
    expect(tiles[0].textContent).not.toContain('Actuel');
    expect(tiles[1].classList.contains('opacity-60')).toBe(false);
    expect(tiles[1].textContent).toContain('Actuel');
  });
});
