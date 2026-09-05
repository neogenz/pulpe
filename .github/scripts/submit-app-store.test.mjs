import assert from "node:assert/strict";
import test from "node:test";

test("existing App Store version stops before any submission mutation", async () => {
  const module = await import("./submit-app-store.mjs").catch(() => ({}));
  assert.equal(
    typeof module.prepareVersion,
    "function",
    "App Store preflight is implemented",
  );
  assert.throws(
    () =>
      module.prepareVersion(
        {
          data: [
            {
              id: "target",
              type: "appStoreVersions",
              attributes: {
                versionString: "1.2.0",
                appStoreState: "PREPARE_FOR_SUBMISSION",
              },
            },
          ],
        },
        "1.2.0",
      ),
    /already exists/,
  );
});

const metadata = {
  marketingVersion: "1.2.0",
  buildNumber: "1",
  whatsNew: { frFR: "Approved notes" },
  reviewNotes: "Approved instructions",
};
function fixture(failSubmit = false) {
  const calls = [];
  const api = (...args) => {
    calls.push(args);
    const command = args.slice(0, 2).join(" ");
    if (command === "versions list" && args.includes("--version"))
      return { data: [{ id: "new" }] };
    if (command === "versions list")
      return {
        data: [
          {
            id: "old",
            type: "appStoreVersions",
            attributes: {
              versionString: "1.1.0",
              appStoreState: "READY_FOR_SALE",
            },
          },
        ],
      };
    if (command === "release stage") return {};
    if (command === "versions get") return { data: { id: "new" } };
    if (command === "review details-for-version")
      return {
        data: { id: "details", attributes: { notes: metadata.reviewNotes } },
      };
    if (command === "localizations list")
      return {
        data: [
          { attributes: { locale: "fr-FR", whatsNew: metadata.whatsNew.frFR } },
        ],
      };
    if (command === "versions view" && args.includes("--include-build"))
      return { id: "new", versionString: "1.2.0", buildId: "build" };
    if (command === "versions view") {
      assert.deepEqual(args.slice(-2), ["--include", "build"]);
      return {
        data: {
          id: "new",
          attributes: {
            versionString: "1.2.0",
            releaseType: "AFTER_APPROVAL",
            appStoreState: calls.some(
              (c) => c[0] === "review" && c[1] === "submit",
            )
              ? "WAITING_FOR_REVIEW"
              : "PREPARE_FOR_SUBMISSION",
          },
          relationships: { build: { data: { id: "build" } } },
        },
      };
    }
    if (command === "review submit" && failSubmit)
      throw new Error("Ambiguous network failure");
    return {};
  };
  return { calls, api };
}
test("linear submission uses approved copy and reads back exact build and publication mode", async () => {
  const module = await import("./submit-app-store.mjs");
  assert.equal(typeof module.submitVersion, "function");
  const { api, calls } = fixture();
  module.submitVersion(metadata, "build", api);
  assert.equal(
    calls.filter((c) => c[0] === "review" && c[1] === "submit").length,
    1,
  );
  assert.ok(calls.some((c) => c.includes("AFTER_APPROVAL")));
  assert.equal(calls.at(-1).slice(0, 2).join(" "), "versions view");
});
test("ambiguous submission failure stops without retry", async () => {
  const { submitVersion } = await import("./submit-app-store.mjs");
  const { api, calls } = fixture(true);
  assert.throws(() => submitVersion(metadata, "build", api), /Ambiguous/);
  assert.equal(
    calls.filter((c) => c[0] === "review" && c[1] === "submit").length,
    1,
  );
});

test("a mismatched final build is not reported as submitted", async () => {
  const { submitVersion } = await import("./submit-app-store.mjs");
  const { api, calls } = fixture();
  let views = 0;
  assert.throws(() =>
    submitVersion(metadata, "build", (...args) => {
      const value = api(...args);
      if (args[0] === "versions" && args[1] === "view" && ++views === 2)
        value.data.relationships.build.data.id = "wrong-build";
      return value;
    }),
  );
  assert.equal(
    calls.filter((c) => c[0] === "review" && c[1] === "submit").length,
    1,
  );
});
