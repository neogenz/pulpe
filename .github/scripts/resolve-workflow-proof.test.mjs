import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePublishedMain,
  resolveWorkflowProof,
} from "./resolve-workflow-proof.mjs";

const sha = "a".repeat(40);
const identity = {
  path: ".github/workflows/staging-proof.yml",
  event: "push",
  head_branch: "main",
  head_sha: sha,
};
const job = {
  id: 99,
  name: "✅ Staging Ready (shadow)",
  status: "completed",
  conclusion: "success",
};

function workflowApi({ duplicateJob = false, duplicateArtifact = false } = {}) {
  return (path, paginate = false) => {
    if (path.includes("/workflows/staging-proof.yml/runs?")) {
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
  workflow: "staging-proof.yml",
  event: "push",
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

test("selects a successful rerun after a failed first attempt", () => {
  const base = workflowApi();
  const api = (path, paginate) => {
    if (path.endsWith("/attempts/1"))
      return {
        ...identity,
        run_attempt: 1,
        status: "completed",
        conclusion: "failure",
      };
    if (path.endsWith("/attempts/2"))
      return {
        ...identity,
        run_attempt: 2,
        status: "completed",
        conclusion: "success",
      };
    if (path.includes("/attempts/2/jobs?")) return [{ jobs: [job] }];
    return base(path, paginate);
  };
  assert.deepEqual(resolveWorkflowProof(options, api), {
    run_id: 42,
    attempt: 2,
    job_id: 99,
  });
});

test("ignores a newer skipped run for the same identity", () => {
  const base = workflowApi();
  const api = (path, paginate) => {
    if (path.includes("/workflows/staging-proof.yml/runs?"))
      return [
        {
          workflow_runs: [
            { id: 43, ...identity },
            { id: 42, ...identity },
          ],
        },
      ];
    if (path.endsWith("/actions/runs/43")) return { run_attempt: 1 };
    if (path.endsWith("/actions/runs/43/attempts/1"))
      return {
        ...identity,
        run_attempt: 1,
        status: "completed",
        conclusion: "skipped",
      };
    return base(path, paginate);
  };
  assert.equal(resolveWorkflowProof(options, api).run_id, 42);
});

for (const field of ["sha", "event", "workflow", "job"]) {
  test(`fails closed on wrong ${field}`, () => {
    const invalid = {
      ...options,
      [field]: field === "sha" ? "b".repeat(40) : `wrong-${field}`,
    };
    assert.throws(() => resolveWorkflowProof(invalid, workflowApi()));
  });
}

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
  for (const artifact of [
    null,
    {
      id: 7,
      name: `proof-${sha}-run-42-attempt-1`,
      expired: true,
    },
  ]) {
    const base = workflowApi();
    const api = (path, paginate) =>
      path.includes("/artifacts?")
        ? [{ artifacts: artifact ? [artifact] : [] }]
        : base(path, paginate);
    assert.throws(
      () => resolveWorkflowProof(exact, api),
      /exactly one unexpired artifact/,
    );
  }
});

const main = "b".repeat(40);
const anchor = "c".repeat(40);
function publicationApi(state = "published") {
  return (path) => {
    if (path.includes("contents/package.json")) {
      return { content: Buffer.from('{"version":"1.3.0"}').toString("base64") };
    }
    if (path.endsWith("releases/latest")) {
      if (state === "missing release") throw new Error("Not Found");
      return {
        tag_name: "v1.2.3",
        draft: state === "draft release",
        prerelease: false,
      };
    }
    if (path.endsWith("git/ref/tags/v1.2.3")) {
      return {
        object: {
          type: state === "unannotated tag" ? "commit" : "tag",
          sha: "e".repeat(40),
        },
      };
    }
    if (path.includes("git/tags/")) {
      return {
        tag: state === "mismatched tag" ? "v9.9.9" : "v1.2.3",
        object: { type: "commit", sha: anchor },
      };
    }
    if (path.endsWith(`compare/${anchor}...${main}`)) {
      if (state === "diverged anchor") return { status: "diverged" };
      return { status: state === "published" ? "identical" : "ahead" };
    }
    throw new Error(`Unexpected publication path: ${path}`);
  };
}

for (const [state, accepted] of [
  ["published", true],
  ["merged unpublished", true],
  ["missing release", false],
  ["draft release", false],
  ["unannotated tag", false],
  ["mismatched tag", false],
  ["diverged anchor", false],
]) {
  test(`${accepted ? "accepts" : "rejects"} ${state} main anchor`, () => {
    const run = () =>
      resolvePublishedMain(
        { repository: "neogenz/pulpe", sha: main },
        publicationApi(state),
      );
    if (accepted)
      assert.deepEqual(run(), { version: "1.2.3", tag: "v1.2.3", sha: anchor });
    else assert.throws(run);
  });
}
