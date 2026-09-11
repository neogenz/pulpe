import assert from "node:assert/strict";
import test from "node:test";

import { validateReleaseManifest } from "./validate-release-manifest.mjs";

const valid = {
  productVersion: "0.49.0",
  githubReleaseNotes:
    "## v0.49.0\n\n### Nouveautés\n\n- Un budget plus clair.\n\n---\n\n[Roadmap](https://github.com/neogenz/pulpe/issues)",
};

test("accepts exact immutable GitHub release notes", () => {
  assert.deepEqual(validateReleaseManifest(valid, "0.49.0"), valid);
});

test("rejects stale or malformed release identity", () => {
  assert.throws(
    () => validateReleaseManifest(valid, "0.49.1"),
    /productVersion/,
  );
  assert.throws(
    () =>
      validateReleaseManifest(
        { ...valid, githubReleaseNotes: "Notes without a version heading" },
        "0.49.0",
      ),
    /githubReleaseNotes/,
  );
});

test("rejects mutable-shape extras and oversized notes", () => {
  assert.throws(
    () => validateReleaseManifest({ ...valid, extra: true }, "0.49.0"),
    /unexpected field/,
  );
  assert.throws(
    () =>
      validateReleaseManifest(
        { ...valid, githubReleaseNotes: `## v0.49.0\n${"x".repeat(20_000)}` },
        "0.49.0",
      ),
    /githubReleaseNotes/,
  );
});
