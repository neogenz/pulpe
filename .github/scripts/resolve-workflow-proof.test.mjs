import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const stagingWorkflow = readFileSync(
  new URL("../workflows/staging-proof.yml", import.meta.url),
  "utf8",
);
const lookupStart = stagingWorkflow.indexOf(
  '          pr_number=$(jq -r .pr_number "$RUNNER_TEMP/merged-pr.json")',
);
const lookupEnd = stagingWorkflow.indexOf(
  '          ci_run_id=$(cat "$RUNNER_TEMP/canonical-ci-run-id")',
);
assert.ok(lookupStart > 0 && lookupEnd > lookupStart);
const lookupScript = stagingWorkflow
  .slice(stagingWorkflow.indexOf("\n", lookupStart) + 1, lookupEnd)
  .split("\n")
  .map((line) => line.replace(/^ {10}/, ""))
  .join("\n");

const canonicalRun = {
  id: 42,
  path: ".github/workflows/ci.yml",
  event: "pull_request",
  head_branch: "fix/fixture",
  head_sha: "a".repeat(40),
  repository: { full_name: "neogenz/pulpe" },
};

// Execute the workflow's real shell and Python; only the external API and
// sleep are fixtures. No Git commands or real credentials enter this harness.
function runStagingLookup(responses) {
  const directory = mkdtempSync(join(tmpdir(), "staging-ci-lookup-"));
  const fixtureProgram = `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
const root = process.env.RUNNER_TEMP;
const args = process.argv.slice(2);
if (process.argv[1].endsWith("/sleep")) {
  appendFileSync(root + "/sleeps", JSON.stringify(args) + "\\n");
} else if (args[0] === "--version") {
  console.log("gh fixture version");
} else {
  const calls = JSON.parse(readFileSync(root + "/calls.json", "utf8"));
  const responses = JSON.parse(readFileSync(root + "/responses.json", "utf8"));
  const response = responses[Math.min(calls.length, responses.length - 1)];
  calls.push(args);
  writeFileSync(root + "/calls.json", JSON.stringify(calls));
  if (response.error) {
    console.error(response.error);
    process.exit(1);
  }
  if (response.raw !== undefined) console.log(response.raw);
  else for (const run of response) console.log(JSON.stringify(run));
}
`;
  try {
    for (const name of ["gh", "sleep"])
      writeFileSync(join(directory, name), fixtureProgram, { mode: 0o755 });
    writeFileSync(join(directory, "responses.json"), JSON.stringify(responses));
    writeFileSync(join(directory, "calls.json"), "[]");
    const env = { ...process.env };
    delete env.GH_TOKEN;
    delete env.GITHUB_TOKEN;
    const result = spawnSync("bash", ["-euo", "pipefail", "-c", lookupScript], {
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...env,
        PATH: `${directory}:${env.PATH}`,
        RUNNER_TEMP: directory,
        GITHUB_REPOSITORY: "neogenz/pulpe",
        head_ref: canonicalRun.head_branch,
        head_sha: canonicalRun.head_sha,
        pr_number: "747",
      },
    });
    const optionalRead = (name) => {
      try {
        return readFileSync(join(directory, name), "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return "";
        throw error;
      }
    };
    return {
      ...result,
      calls: JSON.parse(optionalRead("calls.json")),
      sleeps: optionalRead("sleeps").trim().split("\n").filter(Boolean),
      selected: optionalRead("canonical-ci-run-id"),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("staging lookup recovers when the exact CI run becomes visible", () => {
  const result = runStagingLookup([[], [canonicalRun]]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.selected, "42");
  assert.equal(result.calls.length, 2);
  assert.equal(result.sleeps.length, 1);
});

test("staging lookup stops after three misses with safe query diagnostics", () => {
  const result = runStagingLookup([[]]);
  assert.equal(result.status, 1);
  assert.equal(result.selected, "");
  assert.equal(result.calls.length, 3);
  assert.equal(result.sleeps.length, 2);
  assert.match(result.stdout, /canonical CI run missing for PR #747/);
  assert.match(result.stdout, /gh fixture version/);
  const diagnostics = result.stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
  assert.equal(diagnostics.length, 3);
  assert.deepEqual(diagnostics[2], {
    canonical_ci_lookup: {
      attempt: 3,
      pr_number: 747,
      expected: {
        path: canonicalRun.path,
        event: canonicalRun.event,
        head_branch: canonicalRun.head_branch,
        head_sha: canonicalRun.head_sha,
        repository: canonicalRun.repository.full_name,
      },
      received: 0,
      matched: 0,
    },
  });
});

import {
  resolvePublishedMain,
  resolveWorkflowProof,
} from "./resolve-workflow-proof.mjs";

test("staging lookup selects the newest exact run without a sleep", () => {
  const result = runStagingLookup([
    [
      canonicalRun,
      { ...canonicalRun, id: 43 },
      { ...canonicalRun, id: 99, head_sha: "b".repeat(40) },
    ],
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.selected, "43");
  assert.equal(result.calls.length, 1);
  assert.equal(result.sleeps.length, 0);
  assert.deepEqual(result.calls[0], [
    "api",
    "--paginate",
    "-X",
    "GET",
    "repos/neogenz/pulpe/actions/workflows/ci.yml/runs",
    "-f",
    "event=pull_request",
    "-f",
    "branch=fix/fixture",
    "-f",
    "per_page=100",
    "--jq",
    ".workflow_runs[]",
  ]);
});

for (const key of ["path", "event", "head_branch", "head_sha", "repository"]) {
  test(`staging lookup rejects a mismatched ${key} and names it safely`, () => {
    const wrong = {
      ...canonicalRun,
      [key]: key === "repository" ? { full_name: "someone/else" } : "wrong",
      private_marker: "do-not-log-raw-response",
    };
    const result = runStagingLookup([[wrong]]);
    assert.equal(result.status, 1);
    assert.equal(result.selected, "");
    assert.equal(result.calls.length, 3);
    const rejected = result.stdout
      .split("\n")
      .filter((line) => line.startsWith("{"))
      .map((line) => JSON.parse(line))
      .filter((line) => line.rejected_run);
    assert.equal(rejected.length, 3);
    assert.deepEqual(rejected[0].mismatched_fields, [key]);
    assert.doesNotMatch(result.stdout, /do-not-log-raw-response/);
  });
}

for (const [name, response, error] of [
  ["API denial", { error: "gh: HTTP 403" }, /HTTP 403/],
  ["invalid JSON", { raw: "not JSON" }, /JSONDecodeError/],
]) {
  test(`staging lookup does not retry or suppress ${name}`, () => {
    const result = runStagingLookup([response, [canonicalRun]]);
    assert.equal(result.status, 1);
    assert.equal(result.selected, "");
    assert.equal(result.calls.length, 1);
    assert.equal(result.sleeps.length, 0);
    assert.match(result.stderr, error);
  });
}

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

test("ignores a newer successful run of another intention", () => {
  // release-promotion.yml carries `plan` and `publish` in the same file: a
  // successful `plan` at the same SHA must not prevent resolving the proof
  // that `publish` produced.
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
        conclusion: "success",
      };
    if (path.includes("/runs/43/attempts/1/jobs?"))
      return [
        { jobs: [{ ...job, id: 101, name: "Plan release (read-only)" }] },
      ];
    return base(path, paginate);
  };
  assert.equal(resolveWorkflowProof(options, api).run_id, 42);
});

test("still fails closed when the named job exists but did not succeed", () => {
  const base = workflowApi();
  const api = (path, paginate) =>
    path.includes("/attempts/1/jobs?")
      ? [{ jobs: [{ ...job, conclusion: "skipped" }] }]
      : base(path, paginate);
  assert.throws(
    () => resolveWorkflowProof(options, api),
    /exactly one successful job/,
  );
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
