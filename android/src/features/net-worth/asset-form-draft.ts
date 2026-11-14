import type {
  Asset,
  AssetCategory,
  AssetCreate,
  AssetDirection,
  SupportedCurrency,
} from "pulpe-shared";

/** A Type already on the server, or a name still to create. */
export type AssetCategoryChoice =
  | { kind: "existing"; id: string }
  | { kind: "starter"; name: string };

export interface AssetFormDraft {
  name: string;
  direction: AssetDirection;
  currency: SupportedCurrency;
  category: AssetCategoryChoice | null;
  /** Always a magnitude; `isOverdraft` carries the sign of an account. */
  amount: number | null;
  isOverdraft: boolean;
}

/** Keys under `netWorth.starter.*`, translated where they are shown. */
export const STARTER_KEYS: Record<AssetDirection, readonly string[]> = {
  own: ["accounts", "savings", "investments", "cash", "valuables", "property"],
  owe: ["loan", "mortgage", "leasing", "creditCard"],
};

export function emptyAssetDraft(currency: SupportedCurrency): AssetFormDraft {
  return {
    name: "",
    direction: "own",
    currency,
    category: null,
    amount: null,
    isOverdraft: false,
  };
}

export function assetDraftFrom(asset: Asset): AssetFormDraft {
  return {
    name: asset.name,
    direction: asset.direction,
    currency: asset.currency,
    category: { kind: "existing", id: asset.categoryId },
    amount: Math.abs(asset.latestValue),
    isOverdraft: asset.direction === "own" && asset.latestValue < 0,
  };
}

export interface TypeOptions {
  /** Types an asset of this direction already uses, most used first. */
  used: AssetCategory[];
  /** Starter names that no listed Type carries. */
  suggestions: string[];
}

/** A Type has no direction of its own: it is offered where its assets are. */
export function typeOptions(
  direction: AssetDirection,
  categories: AssetCategory[],
  assets: Asset[],
  starters: string[],
): TypeOptions {
  const uses = new Map<string, number>();
  for (const asset of assets) {
    if (asset.direction === direction) {
      uses.set(asset.categoryId, (uses.get(asset.categoryId) ?? 0) + 1);
    }
  }
  const used = categories
    .map((category, order) => ({ category, order }))
    .filter(({ category }) => uses.has(category.id))
    .sort(
      (a, b) =>
        (uses.get(b.category.id) ?? 0) - (uses.get(a.category.id) ?? 0) ||
        a.order - b.order,
    )
    .map(({ category }) => category);
  const taken = new Set(used.map((category) => category.name.toLowerCase()));
  return {
    used,
    suggestions: starters.filter((name) => !taken.has(name.toLowerCase())),
  };
}

/** The most used Type of the direction, or its first suggestion. */
export function defaultChoice(
  options: TypeOptions,
): AssetCategoryChoice | null {
  const first = options.used[0];
  if (first !== undefined) return { kind: "existing", id: first.id };
  const starter = options.suggestions[0];
  return starter === undefined ? null : { kind: "starter", name: starter };
}

/**
 * A typed name resolves to the matching Type when there is one, hidden ones
 * included, so the server never sees a duplicate; a blank name is no choice.
 */
export function choiceForName(
  name: string,
  existing: AssetCategory[],
): AssetCategoryChoice | null {
  const trimmed = name.trim();
  if (trimmed === "") return null;
  const match = existing.find(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return match === undefined
    ? { kind: "starter", name: trimmed }
    : { kind: "existing", id: match.id };
}

export function isAssetDraftValid(draft: AssetFormDraft): boolean {
  return (
    draft.name.trim() !== "" && draft.category !== null && draft.amount !== null
  );
}

/** A debt is what remains due, never negative; an account goes negative as an overdraft. */
export function signedValue(draft: AssetFormDraft): number | null {
  if (draft.amount === null) return null;
  return draft.direction === "own" && draft.isOverdraft
    ? -draft.amount
    : draft.amount;
}

export function assetCreatePayload(
  draft: AssetFormDraft,
  categoryId: string,
): AssetCreate {
  return {
    name: draft.name.trim(),
    categoryId,
    currency: draft.currency,
    direction: draft.direction,
    inPulpe: false,
    value: signedValue(draft) ?? 0,
  };
}

export interface AssetEdit {
  name?: string;
  category?: AssetCategoryChoice;
  value?: number;
}

/**
 * What saving an edit changes. Empty means close: the backend rejects an empty
 * PATCH, and a value left as it was is not a new snapshot.
 */
export function assetEdit(draft: AssetFormDraft, original: Asset): AssetEdit {
  const edit: AssetEdit = {};
  const name = draft.name.trim();
  if (name !== original.name) edit.name = name;
  const unchanged =
    draft.category?.kind === "existing" &&
    draft.category.id === original.categoryId;
  if (draft.category !== null && !unchanged) edit.category = draft.category;
  const value = signedValue(draft);
  if (value !== null && value !== original.latestValue) edit.value = value;
  return edit;
}
