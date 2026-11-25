import type {
  Asset,
  AssetHistory,
  AssetHistoryEntry,
  NetWorth,
} from 'pulpe-shared';

/** PUL-378 jeu d'essai: ids shared by the account-field specs. */
export const SAVINGS_CATEGORY_ID = '00000000-0000-4000-8000-0000000000c1';
export const DEBTS_CATEGORY_ID = '00000000-0000-4000-8000-0000000000c2';

export const buildAsset = (overrides: Partial<Asset>): Asset => ({
  id: '00000000-0000-4000-8000-000000000a01',
  categoryId: SAVINGS_CATEGORY_ID,
  name: 'Livret',
  currency: 'CHF',
  direction: 'own',
  inPulpe: false,
  archivedAt: null,
  recordedValue: 10_000,
  latestValue: 10_000,
  latestRecordedAt: '2026-11-01T08:00:00.000Z',
  convertedValue: 10_000,
  suggestion: null,
  ...overrides,
});

export const COMPTE_COURANT = buildAsset({
  id: '00000000-0000-4000-8000-000000000b01',
  name: 'Compte courant',
  recordedValue: 5_000,
  latestValue: 5_000,
  convertedValue: 5_000,
});
export const REVOLUT = buildAsset({
  id: '00000000-0000-4000-8000-000000000b02',
  name: 'Revolut',
  recordedValue: 400,
  latestValue: 400,
  convertedValue: 400,
});
export const LIVRET = buildAsset({
  id: '00000000-0000-4000-8000-000000000b03',
});
export const LEASING = buildAsset({
  id: '00000000-0000-4000-8000-000000000b04',
  categoryId: DEBTS_CATEGORY_ID,
  name: 'Leasing',
  direction: 'owe',
  recordedValue: 8_000,
  latestValue: 8_000,
  convertedValue: 8_000,
});
export const OLD_ACCOUNT = buildAsset({
  id: '00000000-0000-4000-8000-000000000b05',
  name: 'Ancien compte',
  archivedAt: '2026-10-01T08:00:00.000Z',
});

/** The ticket's net worth: gross 15 400, debts 8 000, net 7 400. */
export const TICKET_ASSETS: Asset[] = [
  COMPTE_COURANT,
  REVOLUT,
  LIVRET,
  LEASING,
];

export const netWorthResponse = (
  assets: Asset[],
): { data: NetWorth; success: true } => ({
  success: true,
  data: {
    totals: {
      baseCurrency: 'CHF',
      gross: 15_400,
      debts: 8_000,
      net: 7_400,
      incomplete: false,
    },
    categories: [
      { id: SAVINGS_CATEGORY_ID, name: 'Épargne', total: 15_400 },
      { id: DEBTS_CATEGORY_ID, name: 'Dettes', total: 8_000 },
    ],
    assets,
  },
});

/** PUL-379 jeu d'essai: the Compte courant is worth 9 420 since its entry of 5 000 on 1 November. */
export const HISTORY_ACCOUNT = buildAsset({
  id: '00000000-0000-4000-8000-000000000c01',
  name: 'Compte courant',
  recordedValue: 5_000,
  latestValue: 9_420,
  convertedValue: 9_420,
  latestRecordedAt: '2026-11-01T09:00:00.000Z',
});

const historyId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const snapshotEntry = (
  n: number,
  at: string,
  value: number,
): AssetHistoryEntry => ({ type: 'snapshot', id: historyId(n), at, value });

export const movementEntry = (
  n: number,
  at: string,
  name: string,
  effect: number | null,
  supersededAt: string | null = null,
): AssetHistoryEntry => ({
  type: 'movement',
  id: historyId(n),
  at,
  name,
  effect,
  supersededAt,
});

/** Newest first, as the server sends it. */
export const HISTORY_ENTRIES: AssetHistoryEntry[] = [
  movementEntry(6, '2026-11-10T09:00:00.000Z', 'Salaire', 6_000),
  movementEntry(5, '2026-11-05T09:00:00.000Z', 'Restaurant', -80),
  movementEntry(4, '2026-11-03T09:00:00.000Z', 'Loyer', -1_500),
  snapshotEntry(3, '2026-11-01T09:00:00.000Z', 5_000),
  movementEntry(
    2,
    '2026-10-28T09:00:00.000Z',
    'Assurance',
    -300,
    '2026-11-01T09:00:00.000Z',
  ),
  snapshotEntry(1, '2026-10-01T09:00:00.000Z', 4_800),
];

export const historyResponse = (
  history: Partial<AssetHistory> = {},
): { success: true; data: AssetHistory } => ({
  success: true,
  data: {
    asset: HISTORY_ACCOUNT,
    entries: HISTORY_ENTRIES,
    nextCursor: null,
    ...history,
  },
});
