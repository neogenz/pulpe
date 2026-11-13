import type { Asset, NetWorth } from "pulpe-shared";

import { translateForLocale } from "@/core/i18n/i18n";
import {
  assetAgeLabel,
  assetBadges,
  buildNetWorthSections,
  suggestionDetail,
  visibleSuggestion,
} from "./net-worth-sections";

const CATEGORY_OWN = "00000000-0000-4000-8000-000000000001";
const CATEGORY_OWE = "00000000-0000-4000-8000-000000000002";

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    categoryId: CATEGORY_OWN,
    name: "Compte",
    currency: "CHF",
    direction: "own",
    inPulpe: false,
    archivedAt: null,
    latestValue: 100,
    latestRecordedAt: "2026-11-01T10:00:00.000Z",
    convertedValue: 100,
    suggestion: null,
    ...overrides,
  };
}

function netWorth(assets: Asset[]): NetWorth {
  return {
    totals: {
      baseCurrency: "CHF",
      gross: 300,
      debts: 150,
      net: 150,
      incomplete: false,
    },
    categories: [
      { id: CATEGORY_OWN, name: "Comptes", total: 300 },
      { id: CATEGORY_OWE, name: "Crédit", total: 0 },
    ],
    assets,
  };
}

describe("buildNetWorthSections", () => {
  it("files overdrawn accounts and debts on the owed side, never in what I have", () => {
    const sections = buildNetWorthSections(
      netWorth([
        asset({ id: "a", latestValue: 300, convertedValue: 300 }),
        asset({ id: "b", latestValue: -50, convertedValue: -50 }),
        asset({
          id: "c",
          categoryId: CATEGORY_OWE,
          direction: "owe",
          latestValue: 100,
          convertedValue: 100,
        }),
      ]),
      "Découverts",
    );

    expect(sections.categories.map((g) => g.assets.map((a) => a.id))).toEqual([
      ["a"],
    ]);
    expect(sections.debtGroups.map((g) => [g.name, g.total])).toEqual([
      ["Crédit", 100],
      ["Découverts", 50],
    ]);
    expect(sections.debtGroups[1].isType).toBe(false);
  });

  it("keeps archived assets out of the cards and flags the page empty only without any", () => {
    const archived = asset({ archivedAt: "2026-10-01T00:00:00.000Z" });

    const sections = buildNetWorthSections(netWorth([archived]), "Découverts");

    expect(sections.categories).toEqual([]);
    expect(sections.archived).toHaveLength(1);
    expect(sections.isEmpty).toBe(false);
    expect(buildNetWorthSections(netWorth([]), "x").isEmpty).toBe(true);
  });

  it("reports the assets the totals leave out and foreign values", () => {
    const sections = buildNetWorthSections(
      netWorth([asset({ currency: "EUR", convertedValue: null })]),
      "Découverts",
    );

    expect(sections.unconverted).toHaveLength(1);
    expect(sections.hasForeignValues).toBe(true);
  });
});

describe("row presentation", () => {
  it("badges an overdraft and an asset without rate, but not an archived one", () => {
    expect(assetBadges(asset({ latestValue: -1 }))).toEqual(["overdraft"]);
    expect(assetBadges(asset({ convertedValue: null }))).toEqual(["excluded"]);
    expect(
      assetBadges(
        asset({ convertedValue: null, archivedAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toEqual([]);
  });

  it("words the suggestion by direction and hides it on an archived asset", () => {
    const suggestion = { delta: -20, proposedValue: 80 };
    expect(suggestionDetail(asset({ suggestion }))).toBe("drawn");
    expect(
      suggestionDetail(
        asset({ suggestion: { delta: 20, proposedValue: 120 } }),
      ),
    ).toBe("saved");
    expect(suggestionDetail(asset({ direction: "owe", suggestion }))).toBe(
      "repaid",
    );
    expect(
      visibleSuggestion(
        asset({ suggestion, archivedAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toBeNull();
  });

  describe("assetAgeLabel", () => {
    const now = new Date("2026-11-13T12:00:00.000Z");
    const t = (key: string, options?: Record<string, unknown>) =>
      translateForLocale("fr", key, options);

    it.each([
      ["2026-11-13T08:00:00.000Z", "aujourd'hui"],
      ["2026-11-12T12:00:00.000Z", "hier"],
      ["2026-11-10T12:00:00.000Z", "il y a 3 jours"],
      ["2026-09-10T12:00:00.000Z", "il y a 2 mois"],
      ["2024-11-01T12:00:00.000Z", "il y a 2 ans"],
    ])("words %s as %s", (recordedAt, expected) => {
      expect(assetAgeLabel(recordedAt, now, t)).toBe(expected);
    });
  });
});
