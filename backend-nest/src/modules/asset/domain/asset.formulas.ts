import type {
  AssetDirection,
  SupportedCurrency,
  TransactionKind,
} from 'pulpe-shared';
import type {
  Asset,
  AssetCategory,
  AssetHistoryEntry,
  AssetMovements,
  AssetSnapshot,
  AssetWithValue,
  CheckedReal,
  MonthMovements,
  MovementLine,
  NetWorth,
  NetWorthAsset,
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
 * How a movement moves `asset`: by its account first, else by the asset it is
 * linked to. 0 when it is linked to neither.
 */
function linkSign(
  asset: Asset,
  movement: Pick<MovementLine, 'kind' | 'accountId'> & {
    assetId?: string | null;
  },
): number {
  if (movement.accountId === asset.id) {
    return accountSign(asset.direction, movement.kind);
  }
  if (movement.assetId === asset.id) {
    return linkedAssetSign(asset.direction, movement.kind);
  }
  return 0;
}

/**
 * What a prévision counts at `at`, in cents, by the rule of the checked
 * balance: checked by then, the larger of its amount and its movements
 * checked by then; otherwise those movements alone.
 */
function countedCents(
  line: Pick<MovementLine, 'amount' | 'checkedAt' | 'checkedReals'>,
  at: number,
): number {
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

/** What one event of a source retained on an asset, in the asset's cents. */
interface RetainedMove {
  sourceId: string;
  name: string;
  at: number;
  cents: number;
}

/**
 * What each event in `(since, until]` retained on an asset worth `startCents`
 * at `since`, in its own currency: each amount converted from base currency at
 * `rate`, in the order they were checked. A debt never goes below zero: an
 * event only retains what remains due at that moment.
 */
function retainedMoves(
  asset: Asset,
  startCents: number,
  movements: AssetMovements,
  rate: number,
  since: number,
  until = Infinity,
): RetainedMove[] {
  const lineMoves = movements.lines.flatMap((line) => {
    const sign = linkSign(asset, line);
    if (sign === 0) return [];
    return lineEvents(line, since)
      .filter(({ at }) => at <= until)
      .map(({ at, cents }) => ({
        sourceId: line.id,
        name: line.name,
        at,
        cents: sign * cents,
      }));
  });
  const freeMoves = movements.freeMovements.flatMap((movement) => {
    const at = Date.parse(movement.checkedAt);
    const sign = linkSign(asset, movement);
    if (sign === 0 || at <= since || at > until) return [];
    return [
      {
        sourceId: movement.id,
        name: movement.name,
        at,
        cents: sign * toCents(movement.amount),
      },
    ];
  });

  let valueCents = startCents;
  return [...lineMoves, ...freeMoves]
    .sort((a, b) => a.at - b.at)
    .map((move) => {
      const next = valueCents + Math.round(move.cents / rate);
      const retained =
        (asset.direction === 'owe' ? Math.max(0, next) : next) - valueCents;
      valueCents += retained;
      return { ...move, cents: retained };
    });
}

/**
 * The value of an asset in its own currency, in cents: its last entry plus
 * what moved it after that entry (`retainedMoves`). An archived asset keeps its
 * last entry.
 */
function assetValueCents(
  asset: AssetWithValue,
  movements: AssetMovements,
  rate: number,
): number {
  const recordedCents = toCents(asset.recordedValue);
  if (asset.archivedAt !== null) return recordedCents;

  return retainedMoves(
    asset,
    recordedCents,
    movements,
    rate,
    Date.parse(asset.latestRecordedAt),
  ).reduce((valueCents, move) => valueCents + move.cents, recordedCents);
}

/**
 * The value of an asset once the current budget is all checked, in its own
 * currency: its value now plus, for each movement of the month, what it will
 * count then minus what it counts now (`countedCents`), even when an entry
 * already absorbed part of it. A prévision will count the larger of its amount
 * and all its movements, a free movement its amount. Each rest is converted at
 * `rate` like an effect of the value. A debt floors the result at zero, the
 * order of the coming checks being unknown.
 *
 * `null` for an archived asset, without a rate, or when nothing is left to
 * come (`movements` in base currency).
 */
export function monthEndValue(
  asset: NetWorthAsset,
  movements: MonthMovements,
  rate: number | undefined,
): number | null {
  if (asset.archivedAt !== null || rate === undefined) return null;

  const lineRests = movements.lines.map((line) => {
    const realsCents = line.reals.reduce(
      (sum, real) => sum + toCents(real.amount),
      0,
    );
    const checkedReals = line.reals.filter(
      (real): real is CheckedReal => real.checkedAt !== null,
    );
    const counted = countedCents({ ...line, checkedReals }, Infinity);
    return {
      sign: linkSign(asset, line),
      cents: Math.max(toCents(line.amount), realsCents) - counted,
    };
  });
  const freeRests = movements.freeMovements.map((movement) => ({
    sign: linkSign(asset, movement),
    cents: movement.checkedAt === null ? toCents(movement.amount) : 0,
  }));
  const rests = [...lineRests, ...freeRests].filter(
    (rest) => rest.sign !== 0 && rest.cents !== 0,
  );
  if (rests.length === 0) return null;

  const cents = rests.reduce(
    (sum, rest) => sum + Math.round((rest.sign * rest.cents) / rate),
    toCents(asset.value),
  );
  return toUnits(asset.direction === 'owe' ? Math.max(0, cents) : cents);
}

const SNAPSHOT_RANK = 0;
const MOVEMENT_RANK = 1;

/**
 * Where an entry sits in the history: newest first, an entry before a
 * movement at the same instant (the movement is already in it), then by id.
 */
export function historyRank(entry: AssetHistoryEntry) {
  return {
    at: Date.parse(entry.at),
    rank: entry.type === 'snapshot' ? SNAPSHOT_RANK : MOVEMENT_RANK,
    id: entry.id,
  };
}

/**
 * The whole history of an asset, by the rule of its value: every entry, and
 * between two entries (or after the last one) one line per prévision or free
 * movement that moved it, with what it retained over that period
 * (`retainedMoves` from the entry that opens it) at its last check in the
 * period. The movements of the open period add up to the value minus the last
 * entry. Nothing before the first entry is shown.
 *
 * `snapshots` are oldest first, the last one being the asset's last entry;
 * `movements` hold what moved it after the first one. Without a `rate` the
 * movements are listed with a `null` effect.
 */
export function assetHistory(
  asset: Asset,
  snapshots: AssetSnapshot[],
  movements: AssetMovements,
  rate: number | undefined,
): AssetHistoryEntry[] {
  const entries = snapshots.flatMap((snapshot, i): AssetHistoryEntry[] => {
    const next = snapshots[i + 1];
    const bySource = new Map<string, RetainedMove>();
    for (const move of retainedMoves(
      asset,
      toCents(snapshot.value),
      movements,
      rate ?? 1,
      Date.parse(snapshot.recordedAt),
      next ? Date.parse(next.recordedAt) : Infinity,
    )) {
      const previous = bySource.get(move.sourceId);
      bySource.set(move.sourceId, {
        ...move,
        cents: move.cents + (previous?.cents ?? 0),
      });
    }

    return [
      {
        type: 'snapshot',
        id: snapshot.id,
        at: toIso(snapshot.recordedAt),
        value: snapshot.value,
      },
      ...[...bySource.values()].map(
        (move): AssetHistoryEntry => ({
          type: 'movement',
          id: move.sourceId,
          at: new Date(move.at).toISOString(),
          name: move.name,
          effect: rate === undefined ? null : toUnits(move.cents),
          supersededAt: next ? toIso(next.recordedAt) : null,
        }),
      ),
    ];
  });

  return entries.sort((a, b) => {
    const x = historyRank(a);
    const y = historyRank(b);
    return y.at - x.at || x.rank - y.rank || (x.id < y.id ? -1 : 1);
  });
}

function toIso(instant: string): string {
  return new Date(instant).toISOString();
}

function toCents(amount: number): number {
  return Math.round(amount * CENTS_PER_UNIT);
}

function toUnits(cents: number): number {
  return cents === 0 ? 0 : cents / CENTS_PER_UNIT;
}
