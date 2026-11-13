import type { Asset, AssetCategory } from "pulpe-shared";

import {
  assetDraftFrom,
  assetEdit,
  choiceForName,
  defaultChoice,
  emptyAssetDraft,
  isAssetDraftValid,
  signedValue,
  typeOptions,
} from "./asset-form-draft";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const categories: AssetCategory[] = [
  { id: A, name: "Comptes", total: 0 },
  { id: B, name: "Épargne", total: 0 },
];

function asset(overrides: Partial<Asset>): Asset {
  return {
    id: "00000000-0000-4000-8000-0000000000aa",
    categoryId: A,
    name: "UBS",
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

describe("typeOptions", () => {
  it("lists used Types most used first and drops starters a Type already carries", () => {
    const options = typeOptions(
      "own",
      categories,
      [asset({ categoryId: B }), asset({ categoryId: B }), asset({})],
      ["comptes", "Cash"],
    );

    expect(options.used.map((c) => c.id)).toEqual([B, A]);
    expect(options.suggestions).toEqual(["Cash"]);
    expect(defaultChoice(options)).toEqual({ kind: "existing", id: B });
  });

  it("falls back to the first starter when no Type is used", () => {
    expect(
      defaultChoice(typeOptions("owe", categories, [], ["Crédit"])),
    ).toEqual({ kind: "starter", name: "Crédit" });
  });
});

describe("choiceForName", () => {
  it("resolves a typed name to the matching Type, ignoring case", () => {
    expect(choiceForName(" épargne ", categories)).toEqual({
      kind: "existing",
      id: B,
    });
    expect(choiceForName("Or", categories)).toEqual({
      kind: "starter",
      name: "Or",
    });
    expect(choiceForName("  ", categories)).toBeNull();
  });
});

describe("draft", () => {
  it("signs an overdraft on an account only", () => {
    const draft = { ...emptyAssetDraft("CHF"), amount: 40, isOverdraft: true };
    expect(signedValue(draft)).toBe(-40);
    expect(signedValue({ ...draft, direction: "owe" })).toBe(40);
  });

  it("needs a name, a Type and an amount", () => {
    const draft = emptyAssetDraft("CHF");
    expect(isAssetDraftValid(draft)).toBe(false);
    expect(
      isAssetDraftValid({
        ...draft,
        name: "UBS",
        amount: 0,
        category: { kind: "existing", id: A },
      }),
    ).toBe(true);
  });

  it("sends only what an edit changed, and nothing when untouched", () => {
    const original = asset({ latestValue: -30 });
    const draft = assetDraftFrom(original);

    expect(draft.isOverdraft).toBe(true);
    expect(assetEdit(draft, original)).toEqual({});
    expect(
      assetEdit(
        { ...draft, name: "Autre", amount: 10, isOverdraft: false },
        original,
      ),
    ).toEqual({ name: "Autre", value: 10 });
  });
});
