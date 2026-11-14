import { followAccounts, type FollowAccountsInput } from "./follow-accounts";
import {
  createAsset,
  createAssetCategory,
  recordAssetSnapshots,
  updateAsset,
} from "./net-worth-api";

jest.mock("./net-worth-api", () => ({
  createAsset: jest.fn(async () => ({})),
  createAssetCategory: jest.fn(async () => ({ id: "new-type" })),
  recordAssetSnapshots: jest.fn(async () => ({})),
  updateAsset: jest.fn(async () => ({})),
}));

const INPUT: FollowAccountsInput = {
  creates: [{ name: "Neon", value: 120.5 }],
  links: ["a"],
  unlinks: ["b"],
  snapshots: [{ assetId: "a", value: 900 }],
  currency: "CHF",
  categoryName: "Comptes",
};

beforeEach(() => jest.clearAllMocks());

it("creates followed accounts in the existing Type, then links, unlinks and records one batch", async () => {
  await followAccounts(INPUT, [{ id: "type-1", name: "comptes", total: 0 }]);

  expect(createAssetCategory).not.toHaveBeenCalled();
  expect(createAsset).toHaveBeenCalledWith({
    name: "Neon",
    categoryId: "type-1",
    currency: "CHF",
    direction: "own",
    inPulpe: true,
    value: 120.5,
  });
  expect(jest.mocked(updateAsset).mock.calls).toEqual([
    [{ assetId: "a", changes: { inPulpe: true } }],
    [{ assetId: "b", changes: { inPulpe: false } }],
  ]);
  expect(recordAssetSnapshots).toHaveBeenCalledWith({
    items: [{ assetId: "a", value: 900 }],
  });
});

it("creates the Type only when a new account needs it", async () => {
  await followAccounts(INPUT, []);
  expect(createAssetCategory).toHaveBeenCalledWith({ name: "Comptes" });
  expect(createAsset).toHaveBeenCalledWith(
    expect.objectContaining({ categoryId: "new-type" }),
  );

  jest.clearAllMocks();
  await followAccounts({ ...INPUT, creates: [], snapshots: [] }, []);
  expect(createAssetCategory).not.toHaveBeenCalled();
  expect(recordAssetSnapshots).not.toHaveBeenCalled();
});

it("stops at the first refusal", async () => {
  jest.mocked(createAsset).mockRejectedValueOnce(new Error("refused"));
  await expect(followAccounts(INPUT, [])).rejects.toThrow("refused");
  expect(updateAsset).not.toHaveBeenCalled();
  expect(recordAssetSnapshots).not.toHaveBeenCalled();
});
