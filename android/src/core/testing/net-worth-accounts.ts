import type { Asset } from "pulpe-shared";

/** The jeu d'essai of PUL-378: the elements a movement can be attached to. */
export const COMPTE_COURANT = "00000000-0000-4000-8000-0000000000c1";
export const REVOLUT = "00000000-0000-4000-8000-0000000000c2";
export const LIVRET = "00000000-0000-4000-8000-0000000000c3";
export const LEASING = "00000000-0000-4000-8000-0000000000d1";
export const CARTE = "00000000-0000-4000-8000-0000000000d2";

const CATEGORY = "00000000-0000-4000-8000-0000000000aa";

function element(
  id: string,
  name: string,
  direction: Asset["direction"],
  value: number,
  overrides: Partial<Asset> = {},
): Asset {
  return {
    id,
    categoryId: CATEGORY,
    name,
    currency: "CHF",
    direction,
    inPulpe: false,
    archivedAt: null,
    latestValue: value,
    recordedValue: value,
    latestRecordedAt: "2026-11-01T10:00:00.000Z",
    convertedValue: value,
    suggestion: null,
    ...overrides,
  };
}

/** Compte courant 5 000, Revolut 400, Livret 10 000, Leasing 8 000, Carte 200. */
export function contractAssets(overrides: Partial<Asset>[] = []): Asset[] {
  return [
    element(COMPTE_COURANT, "Compte courant", "own", 5000),
    element(REVOLUT, "Revolut", "own", 400),
    element(LIVRET, "Livret", "own", 10_000),
    element(LEASING, "Leasing", "owe", 8000),
    element(CARTE, "Carte de crédit", "owe", 200),
  ].map((asset, index) => ({ ...asset, ...overrides[index] }));
}
