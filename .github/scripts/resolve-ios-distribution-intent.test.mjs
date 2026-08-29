import assert from "node:assert/strict";
import test from "node:test";

import { resolveDistributionIntent } from "./resolve-ios-distribution-intent.mjs";

const options = {
  repository: "neogenz/pulpe",
  sha: "a".repeat(40),
  marketingVersion: "1.4.2",
  buildNumber: "17",
  channel: "release",
  automationBranch: "production",
};

function artifactNameFor(intentOptions) {
  return `ios-distribution-intent-${intentOptions.marketingVersion}-${intentOptions.buildNumber}-${intentOptions.sha}-${intentOptions.channel}`;
}

function fixture({
  proof = {},
  steps = [],
  expired = false,
  branch = "production",
  intentOptions = options,
} = {}) {
  const artifactName = artifactNameFor(intentOptions);
  const routes = new Map([
    [
      `repos/neogenz/pulpe/actions/artifacts?name=${encodeURIComponent(artifactName)}&per_page=100`,
      {
        total_count: 1,
        artifacts: [
          { id: 7, name: artifactName, expired, workflow_run: { id: 42 } },
        ],
      },
    ],
    [
      "repos/neogenz/pulpe/actions/runs/42/attempts/1",
      {
        id: 42,
        path: ".github/workflows/ios-distribute.yml",
        event: "workflow_dispatch",
        head_branch: branch,
        repository: { full_name: options.repository },
        status: "completed",
        run_attempt: 1,
      },
    ],
    [
      "repos/neogenz/pulpe/actions/runs/42/attempts/1/jobs?per_page=100",
      {
        total_count: 1,
        jobs: [{ name: "Archive & Upload iOS", status: "completed", steps }],
      },
    ],
  ]);
  const calls = [];
  const api = (path, paginate = false) => {
    calls.push({ path, paginate });
    assert.ok(routes.has(path), `unexpected API path: ${path}`);
    return routes.get(path);
  };
  const readArtifact = () => ({
    repository: intentOptions.repository,
    source_sha: intentOptions.sha,
    marketing_version: intentOptions.marketingVersion,
    build_number: intentOptions.buildNumber,
    channel: intentOptions.channel,
    state: "uploading",
    run_id: 42,
    run_attempt: 1,
    ...proof,
  });
  return { api, calls, readArtifact };
}

const successfulSteps = [
  { name: "Verify exported application identity", conclusion: "success" },
  { name: "Upload iOS distribution intent", conclusion: "success" },
  { name: "Upload to App Store Connect", conclusion: "success" },
];

test("accepts an exact prior upload intent even when later processing failed", () => {
  const { api, calls, readArtifact } = fixture({ steps: successfulSteps });
  assert.deepEqual(resolveDistributionIntent(options, api, readArtifact), {
    artifact_id: 7,
    run_id: 42,
    attempt: 1,
  });
  assert.equal(calls[0].paginate, false);
  assert.match(calls[0].path, /artifacts\?name=ios-distribution-intent-/);
});

test("rejects stale binaries from another channel or source", () => {
  for (const proof of [
    { channel: "internal" },
    { source_sha: "b".repeat(40) },
    { build_number: "16" },
  ]) {
    const { api, readArtifact } = fixture({ proof, steps: successfulSteps });
    assert.throws(
      () => resolveDistributionIntent(options, api, readArtifact),
      /No exact prior iOS upload provenance/,
    );
  }
});

test("rejects expired artifacts and runs that did not upload successfully", () => {
  let fixtureData = fixture({ expired: true, steps: successfulSteps });
  assert.throws(
    () =>
      resolveDistributionIntent(
        options,
        fixtureData.api,
        fixtureData.readArtifact,
      ),
    /No exact prior iOS upload provenance/,
  );

  fixtureData = fixture({ steps: successfulSteps.slice(0, 2) });
  assert.throws(
    () =>
      resolveDistributionIntent(
        options,
        fixtureData.api,
        fixtureData.readArtifact,
      ),
    /No exact prior iOS upload provenance/,
  );
});

test("rejects intents produced outside the channel branch", () => {
  const { api, readArtifact } = fixture({
    branch: "main",
    steps: successfulSteps,
  });
  assert.throws(
    () => resolveDistributionIntent(options, api, readArtifact),
    /No exact prior iOS upload provenance/,
  );
});

test("accepts an internal intent produced from the main branch", () => {
  const internalOptions = {
    ...options,
    channel: "internal",
    automationBranch: "main",
  };
  const { api, readArtifact } = fixture({
    branch: "main",
    intentOptions: internalOptions,
    steps: successfulSteps,
  });
  assert.deepEqual(
    resolveDistributionIntent(internalOptions, api, readArtifact),
    { artifact_id: 7, run_id: 42, attempt: 1 },
  );
});

test("accepts a tagged release recovery intent produced from main", () => {
  const recoveryOptions = { ...options, automationBranch: "main" };
  const { api, readArtifact } = fixture({
    branch: "main",
    intentOptions: recoveryOptions,
    steps: successfulSteps,
  });
  assert.deepEqual(
    resolveDistributionIntent(recoveryOptions, api, readArtifact),
    { artifact_id: 7, run_id: 42, attempt: 1 },
  );
});
