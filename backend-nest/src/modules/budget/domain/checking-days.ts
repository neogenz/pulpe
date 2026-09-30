import { getBudgetPeriodDates } from 'pulpe-shared';
import type { BudgetLineDecrypted } from './budget.entity';
import type { HistoryMonth } from './drift-history';

type Identity = Partial<
  Pick<BudgetLineDecrypted, 'templateLineId' | 'name' | 'recurrence'>
> &
  Pick<BudgetLineDecrypted, 'kind'>;

/** Monthly lines only; template identity survives renames, manual names match exactly. */
function key(line: Identity): string | null {
  if (line.recurrence !== 'fixed') return null;
  const identity = line.templateLineId
    ? `template:${line.templateLineId}`
    : `name:${line.name?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''}`;
  return `${line.kind}:${identity}`;
}

function checkingSamples(
  months: HistoryMonth[],
  payDay: number,
): Map<string, number[]> {
  const samples = new Map<string, number[]>();
  for (const month of months) {
    const { startDate, endDate } = getBudgetPeriodDates(
      month.month,
      month.year,
      payDay,
    );
    const grouped = new Map<string, typeof month.budgetLines>();
    for (const line of month.budgetLines) {
      const identity = key(line);
      if (identity)
        grouped.set(identity, [...(grouped.get(identity) ?? []), line]);
    }
    for (const [identity, matches] of grouped) {
      // An ambiguous duplicate is not two months of evidence. Ignore retrospective batch checks.
      if (matches.length !== 1 || !matches[0].checkedAt) continue;
      const checked = new Date(matches[0].checkedAt);
      checked.setHours(0, 0, 0, 0);
      if (!(checked >= startDate && checked <= endDate)) continue;
      const elapsed = Math.round(
        (checked.getTime() - startDate.getTime()) / 86_400_000,
      );
      const days = Math.round(
        (endDate.getTime() - startDate.getTime()) / 86_400_000,
      );
      samples.set(identity, [
        ...(samples.get(identity) ?? []),
        elapsed / Math.max(days, 1),
      ]);
    }
  }
  return samples;
}

/** 1-based period days, not calendar dates. No amounts, writes or extra queries. */
export function checkingDays(
  lines: BudgetLineDecrypted[],
  months: HistoryMonth[],
  period: { month: number; year: number },
  payDay: number,
): Record<string, number> {
  const current = getBudgetPeriodDates(period.month, period.year, payDay);
  const past = months
    .filter((m) => m.year * 12 + m.month < period.year * 12 + period.month)
    .sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
    .slice(0, 12);
  const samples = checkingSamples(past, payDay);
  const totalDays = Math.round(
    (current.endDate.getTime() - current.startDate.getTime()) / 86_400_000,
  );
  const identities = new Map<string | null, number>();
  for (const line of lines)
    identities.set(key(line), (identities.get(key(line)) ?? 0) + 1);
  return Object.fromEntries(
    lines.flatMap((line) => {
      if (identities.get(key(line)) !== 1) return [];
      const values = samples.get(key(line) ?? '')?.sort((a, b) => a - b) ?? [];
      if (values.length < 3) return [];
      const mid = Math.floor(values.length / 2);
      const median =
        (values[mid] + values[Math.floor((values.length - 1) / 2)]) / 2;
      return [[line.id, 1 + Math.round(median * totalDays)]];
    }),
  );
}
