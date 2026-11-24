import type { Asset, NetWorth } from 'pulpe-shared';

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
