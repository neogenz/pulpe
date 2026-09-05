import assert from "node:assert/strict";
import test from "node:test";

import { validateAppStoreRelease } from "./validate-app-store-release.mjs";

const valid = {
  productVersion: "0.49.0",
  marketingVersion: "1.6.0",
  buildNumber: "1",
  releaseType: "AFTER_APPROVAL",
  whatsNew: { frFR: "Une nouveauté utile." },
  reviewNotes: "How to test the approved release.",
};

test("accepts exact approved App Store metadata", () => {
  assert.deepEqual(
    validateAppStoreRelease(valid, {
      productVersion: "0.49.0",
      marketingVersion: "1.6.0",
      buildNumber: "1",
    }),
    valid,
  );
});

test("rejects stale identities and unsafe publication modes", () => {
  for (const patch of [
    { productVersion: "0.48.0" },
    { marketingVersion: "1.5.0" },
    { buildNumber: "0" },
    { buildNumber: "2" },
    { releaseType: "MANUAL" },
  ]) {
    assert.throws(() =>
      validateAppStoreRelease(
        { ...valid, ...patch },
        {
          productVersion: "0.49.0",
          marketingVersion: "1.6.0",
          buildNumber: "1",
        },
      ),
    );
  }
});

test("rejects missing or oversized public and review copy", () => {
  for (const patch of [
    { whatsNew: { frFR: "" } },
    { whatsNew: { frFR: "x".repeat(4001) } },
    { reviewNotes: "" },
    { reviewNotes: "x".repeat(4001) },
  ]) {
    assert.throws(() =>
      validateAppStoreRelease(
        { ...valid, ...patch },
        {
          productVersion: "0.49.0",
          marketingVersion: "1.6.0",
          buildNumber: "1",
        },
      ),
    );
  }
});

test("rejects unknown top-level fields and locale keys", () => {
  const expected = {
    productVersion: "0.49.0",
    marketingVersion: "1.6.0",
    buildNumber: "1",
  };
  assert.throws(
    () => validateAppStoreRelease({ ...valid, typo: true }, expected),
    /exact keys/,
  );
  assert.throws(
    () =>
      validateAppStoreRelease(
        { ...valid, whatsNew: { frFR: valid.whatsNew.frFR, frFr: "typo" } },
        expected,
      ),
    /exact locale keys/,
  );
});
