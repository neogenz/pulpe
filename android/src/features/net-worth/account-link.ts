import type { Asset } from "pulpe-shared";

/** The elements a movement may be attached to: « ce que j'ai », then « ce que je dois ». */
export interface AccountChoices {
  own: Asset[];
  owe: Asset[];
}

/** Active elements only: an archived one no longer moves when I check (CA24). */
export function accountChoices(assets: Asset[]): AccountChoices {
  const active = assets.filter((asset) => asset.archivedAt === null);
  return {
    own: active.filter((asset) => asset.direction === "own"),
    owe: active.filter((asset) => asset.direction === "owe"),
  };
}

/** Absent with the flag off or with no element to choose from (CA2, CA28). */
export function isAccountOffered(
  isFlagOn: boolean,
  choices: AccountChoices,
): boolean {
  return isFlagOn && choices.own.length + choices.owe.length > 0;
}

/**
 * The default account as a start value: still active, and never the element the
 * movement already feeds, repays or draws from (CA45).
 */
export function startAccount(
  defaultId: string | null,
  choices: AccountChoices,
  link: string | null = null,
): string | null {
  const isActive = [...choices.own, ...choices.owe].some(
    (asset) => asset.id === defaultId,
  );
  return isActive && defaultId !== link ? defaultId : null;
}

/** The same element cannot be both (CA25): the API refuses it too. */
export function accountConflicts(
  account: string | null,
  link: string | null,
): boolean {
  return account !== null && account === link;
}

/**
 * What a PATCH sends: nothing while the field is untouched, so an edit keeps
 * the account (CA26); `null` is « Aucun ».
 */
export function accountChange(
  initial: string | null,
  current: string | null,
): { accountId?: string | null } {
  return current === initial ? {} : { accountId: current };
}

/** An archived element is never the default: archiving clears the setting (CA35). */
export function isDefaultAccount(asset: Asset, defaultId: string | null) {
  return asset.archivedAt === null && asset.id === defaultId;
}

/** The setting after the menu entry: the default one unsets it, any other takes it (CA47). */
export function defaultAfterToggle(
  asset: Asset,
  current: string | null,
): string | null {
  return current === asset.id ? null : asset.id;
}
