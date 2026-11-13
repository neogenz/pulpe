import type { Asset, NetWorth, SupportedCurrency } from "pulpe-shared";

/** One card of the page: a Type and its assets, or the overdrawn accounts. */
export interface NetWorthGroup {
  id: string;
  name: string;
  total: number;
  assets: Asset[];
  /** False for « Découverts », which gathers accounts of several Types. */
  isType: boolean;
}

export interface NetWorthSections {
  baseCurrency: SupportedCurrency;
  net: number;
  gross: number;
  debtsTotal: number;
  incomplete: boolean;
  /** What I have, by Type, with the total the API returns. */
  categories: NetWorthGroup[];
  /** What I owe, by Type, then the overdrawn accounts. */
  debtGroups: NetWorthGroup[];
  archived: Asset[];
  /** Active assets the API could not convert: the totals leave them out. */
  unconverted: Asset[];
  hasForeignValues: boolean;
  isEmpty: boolean;
}

export const OVERDRAFTS_GROUP_ID = "overdrafts";

const isActive = (asset: Asset) => asset.archivedAt === null;
const isOverdrawn = (asset: Asset) =>
  asset.direction === "own" && asset.latestValue < 0;

/** The API gives no subtotal per debt Type: sum the values it already converted. */
function convertedMagnitude(assets: Asset[]): number {
  const cents = assets.reduce(
    (sum, asset) =>
      sum + Math.abs(Math.round((asset.convertedValue ?? 0) * 100)),
    0,
  );
  return cents / 100;
}

/** Mirrors `NetWorthSections` on iOS: grouping and order only, no conversion. */
export function buildNetWorthSections(
  netWorth: NetWorth,
  overdraftsName: string,
): NetWorthSections {
  const active = netWorth.assets.filter(isActive);
  const { baseCurrency, net, gross, debts, incomplete } = netWorth.totals;

  const categories = netWorth.categories.flatMap((category) => {
    const assets = active.filter(
      (asset) =>
        asset.categoryId === category.id &&
        asset.direction === "own" &&
        asset.latestValue >= 0,
    );
    return assets.length === 0
      ? []
      : [
          {
            id: category.id,
            name: category.name,
            total: category.total,
            assets,
            isType: true,
          },
        ];
  });

  const owed = netWorth.categories.flatMap((category) => {
    const assets = active.filter(
      (asset) => asset.categoryId === category.id && asset.direction === "owe",
    );
    return assets.length === 0
      ? []
      : [
          {
            id: category.id,
            name: category.name,
            total: convertedMagnitude(assets),
            assets,
            isType: true,
          },
        ];
  });
  const overdrawn = active.filter(isOverdrawn);
  const debtGroups: NetWorthGroup[] =
    overdrawn.length === 0
      ? owed
      : [
          ...owed,
          {
            id: OVERDRAFTS_GROUP_ID,
            name: overdraftsName,
            total: convertedMagnitude(overdrawn),
            assets: overdrawn,
            isType: false,
          },
        ];

  const archived = netWorth.assets.filter((asset) => !isActive(asset));
  const counted = [
    ...categories.flatMap((group) => group.assets),
    ...active.filter(
      (asset) => asset.direction === "owe" || asset.latestValue < 0,
    ),
  ];

  return {
    baseCurrency,
    net,
    gross,
    debtsTotal: debts,
    incomplete,
    categories,
    debtGroups,
    archived,
    unconverted: counted.filter((asset) => asset.convertedValue === null),
    hasForeignValues: counted.some((asset) => asset.currency !== baseCurrency),
    isEmpty:
      categories.length === 0 &&
      debtGroups.length === 0 &&
      archived.length === 0,
  };
}

export type NetWorthBadge = "overdraft" | "excluded";

/** What a row warns about. A followed account is not one: its caption says it. */
export function assetBadges(asset: Asset): NetWorthBadge[] {
  const badges: NetWorthBadge[] = [];
  if (isOverdrawn(asset)) badges.push("overdraft");
  if (isActive(asset) && asset.convertedValue === null) badges.push("excluded");
  return badges;
}

/** Foreign values show their base-currency counterpart; with no rate there is none. */
export function showsConversion(
  asset: Asset,
  baseCurrency: SupportedCurrency,
): boolean {
  return asset.currency !== baseCurrency && asset.convertedValue !== null;
}

export type SuggestionDetail = "saved" | "drawn" | "repaid";

/** An archived asset never offers a suggestion, whatever the payload carries. */
export function visibleSuggestion(asset: Asset) {
  return isActive(asset) ? asset.suggestion : null;
}

/** The wording carries the direction, so the amount shown has no sign. */
export function suggestionDetail(asset: Asset): SuggestionDetail {
  if (asset.direction === "owe") return "repaid";
  return (asset.suggestion?.delta ?? 0) < 0 ? "drawn" : "saved";
}

const MS_PER_DAY = 86_400_000;

/** « aujourd'hui », else a relative phrase (« il y a 3 jours ») in the app language. */
export function assetAgeLabel(
  recordedAt: string,
  now: Date,
  locale: string,
  todayLabel: string,
): string {
  const then = new Date(recordedAt);
  if (then.toDateString() === now.toDateString()) return todayLabel;

  const days = Math.round((then.getTime() - now.getTime()) / MS_PER_DAY);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const ago = Math.abs(days);
  if (ago >= 365) return formatter.format(-Math.floor(ago / 365), "year");
  if (ago >= 30) return formatter.format(-Math.floor(ago / 30), "month");
  return formatter.format(days, "day");
}
