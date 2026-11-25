import type {
  AssetDirection,
  SupportedCurrency,
  TransactionKind,
} from 'pulpe-shared';
import type {
  AssetCategory,
  AssetMovements,
  AssetWithValue,
  MovementLine,
  NetWorth,
} from './asset.entity';

const CENTS_PER_UNIT = 100;

export interface NetWorthInput {
  baseCurrency: SupportedCurrency;
  categories: AssetCategory[];
  /** Every asset, archived ones included, with its last entry. */
  assets: AssetWithValue[];
  /**
   * Today's rate per foreign currency: how many `baseCurrency` one unit of it
   * is worth. A missing entry means no rate could be obtained.
   */
  rates: Partial<Record<SupportedCurrency, number>>;
  /**
   * What moved since the earliest last entry of the active assets
   * (`movementsSince`). Amounts are in `baseCurrency`.
   */
  movements: AssetMovements;
}

/**
 * The only place net-worth money is computed. Every figure is rounded to the
 * cent; sums run on integer cents so they do not drift.
 *
 * The value of an asset is its last entry plus what was checked since
 * (`assetValueCents`). An archived asset, or one without a rate, keeps its last
 * entry.
 *
 * Active assets only count in the totals. A positive `own` value goes to its
 * category `total` and to `gross`; a negative `own` value (overdraft) and an
 * `owe` value go to `debts`. An asset with no rate keeps `convertedValue: null`
 * and stays out of the totals, which then carry `incomplete`.
 */
export function computeNetWorth(input: NetWorthInput): NetWorth {
  const { baseCurrency, categories, assets, rates, movements } = input;
  const categoryCents = new Map(categories.map((c) => [c.id, 0]));
  let grossCents = 0;
  let debtsCents = 0;
  let incomplete = false;

  const valuedAssets = assets.map((asset) => {
    const rate = asset.currency === baseCurrency ? 1 : rates[asset.currency];
    if (rate === undefined) {
      incomplete ||= asset.archivedAt === null;
      return { ...asset, value: asset.recordedValue, convertedValue: null };
    }

    const valueCents = assetValueCents(asset, movements, rate);
    const cents = Math.round(valueCents * rate);
    if (asset.archivedAt === null) {
      if (asset.direction === 'own' && cents >= 0) {
        grossCents += cents;
        categoryCents.set(
          asset.categoryId,
          (categoryCents.get(asset.categoryId) ?? 0) + cents,
        );
      } else {
        debtsCents += Math.abs(cents);
      }
    }
    return {
      ...asset,
      value: toUnits(valueCents),
      convertedValue: toUnits(cents),
    };
  });

  return {
    totals: {
      baseCurrency,
      gross: toUnits(grossCents),
      debts: toUnits(debtsCents),
      net: toUnits(grossCents - debtsCents),
      incomplete,
    },
    categories: categories.map((category) => ({
      ...category,
      total: toUnits(categoryCents.get(category.id) ?? 0),
    })),
    assets: valuedAssets,
  };
}

/**
 * The instant after which a movement can still move an active asset: the
 * earliest last entry among them, each entry already holding what was checked
 * before it. `null` without an active asset, whose value is its last entry.
 */
export function movementsSince(assets: AssetWithValue[]): string | null {
  const entries = assets
    .filter((asset) => asset.archivedAt === null)
    .map((asset) => asset.latestRecordedAt);
  if (entries.length === 0) return null;
  return entries.reduce((earliest, entry) =>
    Date.parse(entry) < Date.parse(earliest) ? entry : earliest,
  );
}

/**
 * How a checked prévision moves the asset it is linked to by `assetId`: an
 * Épargne adds to what I own, a Revenu drawn from it subtracts, a Dépense
 * repays what I owe. Any other pairing (the database refuses to link them)
 * moves nothing.
 */
function linkedAssetSign(direction: AssetDirection, kind: TransactionKind) {
  if (direction === 'own') {
    return kind === 'saving' ? 1 : kind === 'income' ? -1 : 0;
  }
  return kind === 'expense' ? -1 : 0;
}

/**
 * How a checked movement moves its account (`accountId`): a Revenu raises what
 * I own, a Dépense or an Épargne lowers it. A debt is the other way round.
 */
function accountSign(direction: AssetDirection, kind: TransactionKind) {
  const inflow = kind === 'income' ? 1 : -1;
  return direction === 'own' ? inflow : -inflow;
}

/**
 * What a prévision counts at `at`, in cents, by the rule of the checked
 * balance: checked by then, the larger of its amount and its movements
 * checked by then; otherwise those movements alone.
 */
function countedCents(line: MovementLine, at: number): number {
  const realsCents = line.checkedReals
    .filter((real) => Date.parse(real.checkedAt) <= at)
    .reduce((sum, real) => sum + toCents(real.amount), 0);
  const lineChecked =
    line.checkedAt !== null && Date.parse(line.checkedAt) <= at;
  return lineChecked ? Math.max(toCents(line.amount), realsCents) : realsCents;
}

interface MoveEvent {
  at: number;
  /** Signed, in base-currency cents. */
  cents: number;
}

/**
 * What a prévision added after `since`, one event per instant it counted more:
 * its own check and each of its checked movements. The sum is what it counts
 * now minus what it counted at `since`, both from the current amounts.
 */
function lineEvents(line: MovementLine, since: number): MoveEvent[] {
  const instants = [
    ...new Set(
      [line.checkedAt, ...line.checkedReals.map((real) => real.checkedAt)]
        .filter((checkedAt) => checkedAt !== null)
        .map((checkedAt) => Date.parse(checkedAt))
        .filter((at) => at > since),
    ),
  ].sort((a, b) => a - b);

  let previous = countedCents(line, since);
  return instants.flatMap((at) => {
    const counted = countedCents(line, at);
    const cents = counted - previous;
    previous = counted;
    return cents > 0 ? [{ at, cents }] : [];
  });
}

/**
 * The value of an asset in its own currency, in cents: its last entry plus
 * what moved it after that entry, each amount converted from base currency at
 * `rate`. A debt takes the movements in the order they were checked and never
 * goes below zero: each one only counts for what remains due at that moment.
 * An archived asset keeps its last entry.
 */
function assetValueCents(
  asset: AssetWithValue,
  movements: AssetMovements,
  rate: number,
): number {
  const recordedCents = toCents(asset.recordedValue);
  if (asset.archivedAt !== null) return recordedCents;

  const since = Date.parse(asset.latestRecordedAt);
  const lineMoves = movements.lines.flatMap((line) => {
    const sign =
      line.accountId === asset.id
        ? accountSign(asset.direction, line.kind)
        : line.assetId === asset.id
          ? linkedAssetSign(asset.direction, line.kind)
          : 0;
    if (sign === 0) return [];
    return lineEvents(line, since).map(({ at, cents }) => ({
      at,
      cents: sign * cents,
    }));
  });
  const freeMoves = movements.freeMovements
    .filter(
      (movement) =>
        movement.accountId === asset.id &&
        Date.parse(movement.checkedAt) > since,
    )
    .map((movement) => ({
      at: Date.parse(movement.checkedAt),
      cents:
        accountSign(asset.direction, movement.kind) * toCents(movement.amount),
    }));

  return [...lineMoves, ...freeMoves]
    .sort((a, b) => a.at - b.at)
    .reduce((valueCents, { cents }) => {
      const next = valueCents + Math.round(cents / rate);
      return asset.direction === 'owe' ? Math.max(0, next) : next;
    }, recordedCents);
}

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

function toUnits(cents: number): number {
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
