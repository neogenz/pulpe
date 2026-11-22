import { followAccounts, type FollowAccountsInput } from "./follow-accounts";
import { recordAssetSnapshots, updateAsset } from "./net-worth-api";

jest.mock("./net-worth-api", () => ({
  recordAssetSnapshots: jest.fn(async () => ({})),
  updateAsset: jest.fn(async () => ({})),
}));

const INPUT: FollowAccountsInput = {
  links: ["a"],
  unlinks: ["b"],
  snapshots: [{ assetId: "a", value: 900 }],
};

beforeEach(() => jest.clearAllMocks());

it("links, unlinks and records one batch of balances", async () => {
  await followAccounts(INPUT);

  expect(jest.mocked(updateAsset).mock.calls).toEqual([
    [{ assetId: "a", changes: { inPulpe: true } }],
    [{ assetId: "b", changes: { inPulpe: false } }],
  ]);
  expect(recordAssetSnapshots).toHaveBeenCalledWith({
    items: [{ assetId: "a", value: 900 }],
  });
});

it("records nothing when no balance was typed", async () => {
  await followAccounts({ ...INPUT, snapshots: [] });
  expect(recordAssetSnapshots).not.toHaveBeenCalled();
});

it("stops at the first refusal", async () => {
  jest.mocked(updateAsset).mockRejectedValueOnce(new Error("refused"));
  await expect(followAccounts(INPUT)).rejects.toThrow("refused");
  expect(recordAssetSnapshots).not.toHaveBeenCalled();
});
