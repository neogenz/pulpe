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

test("version components are canonical and bounded like the Ruby validator", () => {
  for (const field of ["productVersion", "marketingVersion"]) {
    for (const version of [
      "01.2.3",
      "1.02.3",
      "1.2.03",
      "1.2.3.4",
      "1.2",
      "1.2.3-beta",
      "1000000000000000000.2.3",
    ]) {
      const metadata = { ...valid, [field]: version };
      // Match the expected identity so rejection proves format validation.
      assert.throws(
        () => validateAppStoreRelease(metadata, metadata),
        new RegExp(`${field} must use X.Y.Z`),
      );
    }
    for (const version of ["0.0.0", "1.2.3", "999999999999999999.0.0"]) {
      const metadata = { ...valid, [field]: version };
      assert.equal(validateAppStoreRelease(metadata, metadata), metadata);
    }
  }
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
