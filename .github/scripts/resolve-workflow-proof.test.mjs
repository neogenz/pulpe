import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePublishedMain,
  resolveWorkflowProof,
} from "./resolve-workflow-proof.mjs";

const sha = "a".repeat(40);
const identity = {
  path: ".github/workflows/release-gate.yml",
  event: "pull_request",
  head_branch: "release/v1.2.3",
  head_sha: sha,
};
const job = {
  id: 99,
  name: "✅ Release Gate",
  status: "completed",
  conclusion: "success",
};

function workflowApi({ duplicateJob = false, duplicateArtifact = false } = {}) {
  return (path, paginate = false) => {
    if (path.includes("/workflows/release-gate.yml/runs?")) {
      return [{ workflow_runs: [{ id: 42, ...identity }] }];
    }
    if (path.endsWith("/actions/runs/42")) return { run_attempt: 2 };
    const attempt = Number(path.match(/\/attempts\/(\d)$/)?.[1]);
    if (attempt) {
      return {
        ...identity,
        run_attempt: attempt,
        status: "completed",
        conclusion: attempt === 1 ? "success" : "failure",
      };
    }
    if (path.includes("/attempts/1/jobs?")) {
      return [{ jobs: duplicateJob ? [job, { ...job, id: 100 }] : [job] }];
    }
    if (path.includes("/artifacts?")) {
      const artifact = {
        id: 7,
        name: `proof-${sha}-run-42-attempt-1`,
        expired: false,
      };
      return [
        {
          artifacts: duplicateArtifact
            ? [artifact, { ...artifact, id: 8 }]
            : [artifact],
        },
      ];
    }
    throw new Error(`Unexpected API path (${paginate}): ${path}`);
  };
}

const options = {
  repository: "neogenz/pulpe",
  workflow: "release-gate.yml",
  event: "pull_request",
  branch: identity.head_branch,
  sha,
  job: job.name,
};

test("keeps an immutable successful attempt after a failed rerun", () => {
  assert.deepEqual(resolveWorkflowProof(options, workflowApi()), {
    run_id: 42,
    attempt: 1,
    job_id: 99,
  });
});

test("fails closed when the named successful job is ambiguous", () => {
  assert.throws(
    () => resolveWorkflowProof(options, workflowApi({ duplicateJob: true })),
    /exactly one successful job/,
  );
});

test("binds one unexpired artifact to SHA, run, and attempt", () => {
  const exact = {
    ...options,
    artifactTemplate: "proof-{sha}-run-{run_id}-attempt-{attempt}",
  };
  assert.deepEqual(resolveWorkflowProof(exact, workflowApi()), {
    run_id: 42,
    attempt: 1,
    job_id: 99,
    artifact_id: 7,
    artifact_name: `proof-${sha}-run-42-attempt-1`,
  });
  assert.throws(
    () => resolveWorkflowProof(exact, workflowApi({ duplicateArtifact: true })),
    /exactly one unexpired artifact/,
  );
});

const main = "b".repeat(40);
function publicationApi(state = "published") {
  return (path) => {
    if (path.includes("contents/package.json")) {
      return { content: Buffer.from('{"version":"1.2.3"}').toString("base64") };
    }
    if (path.endsWith("git/ref/tags/v1.2.3")) {
      if (state === "unpublished") throw new Error("Not Found");
      return { object: { type: "tag", sha: "c".repeat(40) } };
    }
    if (path.includes("git/tags/")) {
      return {
        tag: "v1.2.3",
        object: {
          type: "commit",
          sha: state === "mismatched tag" ? "d".repeat(40) : main,
        },
      };
    }
    if (path.endsWith("releases/tags/v1.2.3")) {
      if (state === "missing release") throw new Error("Not Found");
      return {
        tag_name: "v1.2.3",
        target_commitish: main,
        draft: false,
        prerelease: false,
      };
    }
    throw new Error(`Unexpected publication path: ${path}`);
  };
}

for (const [state, accepted] of [
  ["fully published", true],
  ["unpublished", false],
  ["mismatched tag", false],
  ["missing release", false],
]) {
  test(`${accepted ? "accepts" : "rejects"} ${state} current main`, () => {
    const run = () =>
      resolvePublishedMain(
        { repository: "neogenz/pulpe", sha: main },
        publicationApi(state),
      );
    if (accepted) assert.deepEqual(run(), { version: "1.2.3", tag: "v1.2.3" });
    else assert.throws(run);
  });
}
