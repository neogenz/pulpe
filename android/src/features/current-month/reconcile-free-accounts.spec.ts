import { createMMKV } from "react-native-mmkv";

import {
  clearFreeAccounts,
  readFreeAccounts,
  saveFreeAccounts,
} from "./reconcile-free-accounts";

// The disk is what must stay free of amounts, so the raw writes are recorded.
const mockWrites: string[] = [];
jest.mock("react-native-mmkv", () => {
  const values = new Map<string, string>();
  return {
    createMMKV: jest.fn(() => ({
      set: (key: string, value: string) => {
        mockWrites.push(value);
        values.set(key, value);
      },
      getString: (key: string) => values.get(key),
      remove: (key: string) => values.delete(key),
    })),
  };
});

afterEach(() => {
  clearFreeAccounts();
  mockWrites.length = 0;
});

it("keeps names and sides for the next comparison, until it is cleared", () => {
  expect(createMMKV).toHaveBeenCalled();
  expect(readFreeAccounts()).toEqual([]);
  saveFreeAccounts([
    { name: "Revolut", side: "own" },
    { name: "Klarna", side: "owe" },
  ]);
  expect(readFreeAccounts()).toEqual([
    { name: "Revolut", side: "own" },
    { name: "Klarna", side: "owe" },
  ]);
  clearFreeAccounts();
  expect(readFreeAccounts()).toEqual([]);
});

it("never writes an amount to storage", () => {
  saveFreeAccounts([
    { name: "Revolut", side: "own", amountText: "4217.35" } as never,
  ]);

  expect(mockWrites).toEqual([
    JSON.stringify([{ name: "Revolut", side: "own" }]),
  ]);
  expect(mockWrites.join("")).not.toMatch(/amountText|4217/);
});
