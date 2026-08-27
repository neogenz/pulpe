import assert from "node:assert/strict";
import test from "node:test";

import {
  releaseIdentity,
  resolveReleaseState,
} from "./resolve-release-state.mjs";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

const promotion = {
  repository: "neogenz/pulpe",
  workflow: "release-promotion.yml",
  version: "0.47.0",
};
const ios = {
  repository: "neogenz/pulpe",
  workflow: "ios-distribute.yml",
  version: "1.4.2",
  channel: "release",
  build: "18",
  sha: SHA,
};

const run = (id, status, conclusion, title) => ({
  id,
  status,
  conclusion,
  display_title: title,
  html_url: `https://github.com/neogenz/pulpe/actions/runs/${id}`,
});

// One-page API double: workflow runs, branch refs, PR lists, and tag refs.
const stub =
  ({ runs = [], branchRefs = [], prs = {}, tagRefs = [] } = {}) =>
  (path, paginate) => {
    if (path.includes("/actions/workflows/"))
      return paginate
        ? [{ total_count: runs.length, workflow_runs: runs }]
        : runs;
    if (path.includes("/matching-refs/heads/")) return branchRefs;
    if (path.includes("/matching-refs/tags/")) return tagRefs;
    if (path.includes("/pulls?state=open&base=preview"))
      return prs.preview ?? [];
    if (path.includes("/pulls?state=open&base=main")) return prs.main ?? [];
    throw new Error(`Unexpected API path: ${path}`);
  };

const branchRef = (sha) => [
  { ref: "refs/heads/release/v0.47.0", object: { sha } },
];

test("identity binds every required field and changes with any of them", () => {
  assert.equal(releaseIdentity(promotion), "🚦 prepare release/v0.47.0");
  assert.equal(releaseIdentity(ios), `📲 iOS release v1.4.2 (18) ${SHA}`);
  assert.notEqual(
    releaseIdentity(ios),
    releaseIdentity({ ...ios, build: "19" }),
  );
  assert.notEqual(
    releaseIdentity(ios),
    releaseIdentity({ ...ios, sha: OTHER_SHA }),
  );
  assert.notEqual(
    releaseIdentity(ios),
    releaseIdentity({ ...ios, channel: "internal" }),
  );

  assert.throws(() => releaseIdentity({ ...promotion, version: "v0.47.0" }));
  assert.throws(() => releaseIdentity({ ...ios, sha: SHA.slice(0, 12) }));
  assert.throws(() => releaseIdentity({ ...ios, channel: "beta" }));
  assert.throws(() => releaseIdentity({ ...ios, build: "0" }));
  assert.throws(() => releaseIdentity({ ...promotion, repository: "pulpe" }));
  assert.throws(() =>
    releaseIdentity({ ...promotion, workflow: "production.yml" }),
  );
});

test("an absent identity is the only state that allows a new dispatch", () => {
  const state = resolveReleaseState(promotion, stub());
  assert.equal(state.state, "absent");
  assert.equal(state.identity, "🚦 prepare release/v0.47.0");
  assert.equal(state.resources.branch_sha, null);
  assert.deepEqual(state.resources.open_prs, []);
});

test("an active run is returned instead of creating a duplicate", () => {
  const state = resolveReleaseState(
    promotion,
    stub({
      runs: [
        run(7, "in_progress", null, "🚦 prepare release/v0.47.0"),
        run(6, "completed", "success", "🚦 prepare release/v0.46.0"),
      ],
    }),
  );
  assert.equal(state.state, "active");
  assert.equal(state.run.run_id, 7);
});

test("a succeeded run returns the existing resource for the same key", () => {
  const state = resolveReleaseState(
    promotion,
    stub({
      runs: [run(5, "completed", "success", "🚦 prepare release/v0.47.0")],
      branchRefs: branchRef(SHA),
      prs: {
        preview: [{ number: 42, html_url: "u", head: { sha: SHA } }],
      },
    }),
  );
  assert.equal(state.state, "succeeded");
  assert.equal(state.run.run_id, 5);
  assert.deepEqual(state.resources.open_prs, [
    { base: "preview", number: 42, url: "u" },
  ]);
});

test("iOS identities resolve runs without version resources", () => {
  const state = resolveReleaseState(
    ios,
    stub({
      runs: [
        run(9, "completed", "success", `📲 iOS release v1.4.2 (18) ${SHA}`),
        run(8, "completed", "success", `📲 iOS release v1.4.2 (17) ${SHA}`),
      ],
    }),
  );
  assert.equal(state.state, "succeeded");
  assert.equal(state.run.run_id, 9);
  assert.equal(state.resources, undefined);
});

test("only the latest terminal run is retryable, and only explicitly", () => {
  const runs = [
    run(4, "completed", "failure", "🚦 prepare release/v0.47.0"),
    run(3, "completed", "cancelled", "🚦 prepare release/v0.47.0"),
  ];
  const failed = resolveReleaseState(promotion, stub({ runs }));
  assert.equal(failed.state, "failed");
  assert.equal(failed.run.run_id, 4);

  const retry = resolveReleaseState(
    { ...promotion, retry: "4" },
    stub({ runs }),
  );
  assert.equal(retry.state, "retry-allowed");
  assert.equal(retry.run.run_id, 4);

  assert.throws(
    () => resolveReleaseState({ ...promotion, retry: "3" }, stub({ runs })),
    /Retry must target the latest terminal run/,
  );
  assert.throws(() =>
    resolveReleaseState(
      { ...promotion, retry: "4" },
      stub({
        runs: [
          ...runs,
          run(5, "completed", "success", "🚦 prepare release/v0.47.0"),
        ],
      }),
    ),
  );
});

test("duplicate active runs fail closed without any dispatch", () => {
  assert.throws(
    () =>
      resolveReleaseState(
        promotion,
        stub({
          runs: [
            run(2, "queued", null, "🚦 prepare release/v0.47.0"),
            run(1, "in_progress", null, "🚦 prepare release/v0.47.0"),
          ],
        }),
      ),
    /duplicate active runs/,
  );
});

test("incomplete pagination fails closed", () => {
  const api = (path, paginate) => {
    if (path.includes("/actions/workflows/") && paginate)
      return [{ total_count: 3, workflow_runs: [] }];
    throw new Error(`Unexpected API path: ${path}`);
  };
  assert.throws(
    () => resolveReleaseState(promotion, api),
    /Incomplete workflow run pagination/,
  );
});

test("resource drift and ambiguity fail closed", () => {
  assert.throws(
    () =>
      resolveReleaseState(
        promotion,
        stub({
          branchRefs: [...branchRef(SHA), ...branchRef(OTHER_SHA)],
        }),
      ),
    /Ambiguous release branch refs/,
  );
  assert.throws(
    () =>
      resolveReleaseState(
        promotion,
        stub({
          branchRefs: branchRef(SHA),
          prs: {
            main: [{ number: 41, html_url: "u", head: { sha: OTHER_SHA } }],
          },
        }),
      ),
    /Release PR drifted from its branch/,
  );
  assert.throws(() =>
    resolveReleaseState(
      promotion,
      stub({
        branchRefs: branchRef(SHA),
        prs: {
          preview: [
            { number: 1, html_url: "u", head: { sha: SHA } },
            { number: 2, html_url: "u", head: { sha: SHA } },
          ],
        },
      }),
    ),
  );
});

test("an existing tag marks the version published instead of dispatchable", () => {
  const state = resolveReleaseState(
    promotion,
    stub({ tagRefs: [{ ref: "refs/tags/v0.47.0" }] }),
  );
  assert.equal(state.state, "published");
  assert.equal(state.resources.tag_exists, true);
});
