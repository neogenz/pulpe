import {
  CARTE,
  COMPTE_COURANT,
  contractAssets,
  LEASING,
  LIVRET,
  REVOLUT,
} from "@/core/testing/net-worth-accounts";

import {
  accountChange,
  accountChoices,
  accountConflicts,
  defaultAfterToggle,
  isAccountOffered,
  isDefaultAccount,
  startAccount,
} from "./account-link";

const assets = contractAssets();
const choices = accountChoices(assets);

describe("accountChoices (CA1)", () => {
  it("lists what I have, then what I owe, active ones only", () => {
    expect(choices.own.map((asset) => asset.name)).toEqual([
      "Compte courant",
      "Revolut",
      "Livret",
    ]);
    expect(choices.owe.map((asset) => asset.name)).toEqual([
      "Leasing",
      "Carte de crédit",
    ]);
    const archived = accountChoices(
      contractAssets([{}, { archivedAt: "2026-11-02T00:00:00.000Z" }]),
    );
    expect(archived.own.map((asset) => asset.id)).not.toContain(REVOLUT);
  });

  it("keeps the archived account a movement already has (CA24)", () => {
    const kept = accountChoices(
      contractAssets([{}, { archivedAt: "2026-11-02T00:00:00.000Z" }]),
      REVOLUT,
    );
    expect(kept.own.map((asset) => asset.id)).toContain(REVOLUT);
  });
});

describe("isAccountOffered (CA2)", () => {
  it("is absent with the flag off or with no active element", () => {
    expect(isAccountOffered(true, choices)).toBe(true);
    expect(isAccountOffered(false, choices)).toBe(false);
    expect(isAccountOffered(true, accountChoices([]))).toBe(false);
  });
});

describe("startAccount (CA3, CA29, CA33, CA45)", () => {
  it("starts on « Aucun » without a default", () => {
    expect(startAccount(null, choices)).toBeNull();
  });

  it("starts on the default account, a debt included", () => {
    expect(startAccount(COMPTE_COURANT, choices)).toBe(COMPTE_COURANT);
    expect(startAccount(CARTE, choices)).toBe(CARTE);
    expect(startAccount(REVOLUT, choices)).toBe(REVOLUT);
  });

  it("ignores a default that is no longer active (CA35)", () => {
    const withoutRevolut = accountChoices(
      contractAssets([{}, { archivedAt: "2026-11-02T00:00:00.000Z" }]),
    );
    expect(startAccount(REVOLUT, withoutRevolut)).toBeNull();
  });

  it("never starts on the element the line already feeds (CA45)", () => {
    expect(startAccount(LIVRET, choices, LIVRET)).toBeNull();
    expect(startAccount(COMPTE_COURANT, choices, LIVRET)).toBe(COMPTE_COURANT);
  });
});

describe("accountConflicts (CA25)", () => {
  it("refuses the same element as account and as link", () => {
    expect(accountConflicts(LIVRET, LIVRET)).toBe(true);
    expect(accountConflicts(COMPTE_COURANT, LIVRET)).toBe(false);
    expect(accountConflicts(null, null)).toBe(false);
    expect(accountConflicts(LEASING, null)).toBe(false);
  });
});

describe("accountChange (CA26)", () => {
  it("omits the account while the field is untouched", () => {
    expect(accountChange(COMPTE_COURANT, COMPTE_COURANT)).toEqual({});
    expect(accountChange(null, null)).toEqual({});
  });

  it("sends the new account, and null for « Aucun »", () => {
    expect(accountChange(COMPTE_COURANT, REVOLUT)).toEqual({
      accountId: REVOLUT,
    });
    expect(accountChange(COMPTE_COURANT, null)).toEqual({ accountId: null });
  });
});

describe("default account in « Mon patrimoine » (CA47, CA34)", () => {
  const [compteCourant, revolut] = assets;

  it("badges the default and takes it from the menu", () => {
    expect(isDefaultAccount(compteCourant, COMPTE_COURANT)).toBe(true);
    expect(isDefaultAccount(revolut, COMPTE_COURANT)).toBe(false);
    expect(defaultAfterToggle(revolut, COMPTE_COURANT)).toBe(REVOLUT);
  });

  it("offers « Ne plus utiliser » on the default one, which resets to « Aucun »", () => {
    expect(defaultAfterToggle(compteCourant, COMPTE_COURANT)).toBeNull();
  });

  it("never badges an archived element (CA35)", () => {
    expect(
      isDefaultAccount(
        { ...compteCourant, archivedAt: "2026-11-02T00:00:00.000Z" },
        COMPTE_COURANT,
      ),
    ).toBe(false);
  });
});
