import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const action = read(".github/actions/setup-supabase-cli/action.yml");
const workflow = read(".github/workflows/ci.yml");
const stagingProof = read(".github/workflows/staging-proof.yml");
const releasePromotion = read(".github/workflows/release-promotion.yml");
const releaseGate = read(".github/workflows/release-gate.yml");
const production = read(".github/workflows/production.yml");
const productionFinalize = read(".github/workflows/production-finalize.yml");
const iosDistribution = read(".github/workflows/ios-distribute.yml");
const dockerfile = read("backend-nest/Dockerfile");
const rootPackage = JSON.parse(read("package.json"));
const backendPackage = JSON.parse(read("backend-nest/package.json"));
const ciGuide = read("docs/CI.md");
const releaseSkill = read(".claude/skills/release/SKILL.md");
const frontendEslintConfig = require("../../frontend/eslint.config.js");

function selectReleaseGateProof({ runs, attempts, jobs }, branch, candidate) {
  const matchingRuns = runs
    .filter(
      (run) =>
        run.path === ".github/workflows/release-gate.yml" &&
        run.event === "pull_request" &&
        run.head_branch === branch &&
        run.head_sha === candidate,
    )
    .toSorted((left, right) => right.id - left.id);

  const candidates = [];
  for (const run of matchingRuns) {
    const runAttempts = attempts[run.id];
    if (!runAttempts) return null;
    for (const attempt of runAttempts) {
      const exactIdentity =
        attempt.path === ".github/workflows/release-gate.yml" &&
        attempt.event === "pull_request" &&
        attempt.head_branch === branch &&
        attempt.head_sha === candidate &&
        attempt.status === "completed";
      if (!exactIdentity) return null;

      const attemptJobs = jobs[`${run.id}:${attempt.run_attempt}`];
      if (!attemptJobs) return null;
      const namedJobs = attemptJobs.filter(
        (job) => job.name === "✅ Release Gate",
      );
      if (namedJobs.length > 1) return null;
      if (attempt.conclusion === "success") {
        if (
          namedJobs.length !== 1 ||
          namedJobs[0].status !== "completed" ||
          namedJobs[0].conclusion !== "success"
        ) {
          return null;
        }
        candidates.push({
          runId: run.id,
          attempt: attempt.run_attempt,
          jobId: namedJobs[0].id,
        });
      }
    }
  }
  return (
    candidates.toSorted(
      (left, right) => right.runId - left.runId || right.attempt - left.attempt,
    )[0] ?? null
  );
}

function reduceReleaseEvent(release, event) {
  if (release.state === "published") return release;

  const transition = {
    candidate_prepared:
      event.type === "staging_proven" && event.exactSha
        ? "staging_proven"
        : null,
    staging_proven:
      event.type === "production_approved" && event.humanApproval
        ? "production_approved"
        : null,
    production_approved:
      event.type === "predeploy_succeeded" && event.exactRunAttempt
        ? "predeploy_authorized"
        : null,
    predeploy_authorized:
      event.type === "railway_succeeded" &&
      event.trustedDeployment &&
      event.trustedStatus &&
      event.exactSha &&
      event.activeDeployment
        ? "railway_deployed"
        : null,
    railway_deployed:
      event.type === "providers_correlated" && event.exactSha
        ? "providers_correlated"
        : null,
    providers_correlated:
      event.type === "proof_uploaded" && event.exactRunAttempt
        ? "production_proven"
        : null,
    production_proven: event.type === "publish" ? "published" : null,
  }[release.state];

  if (!transition) return release;
  return {
    state: transition,
    publishCount: release.publishCount + (transition === "published" ? 1 : 0),
  };
}

const gitEnvironment = { ...process.env };
for (const variable of [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_DIR",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_WORK_TREE",
]) {
  delete gitEnvironment[variable];
}
Object.assign(gitEnvironment, {
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "core.hooksPath",
  GIT_CONFIG_VALUE_0: "/dev/null",
});

const git = (repository, ...args) =>
  execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: gitEnvironment,
  }).trim();

const commitFile = (repository, path, content, message) => {
  writeFileSync(join(repository, path), content);
  git(repository, "add", path);
  git(repository, "commit", "-m", message);
  return git(repository, "rev-parse", "HEAD");
};

const mainMergeLeavesCandidateUnchanged = (repository, candidate, main) => {
  try {
    const candidateTree = git(repository, "rev-parse", `${candidate}^{tree}`);
    const mergedTree = git(
      repository,
      "merge-tree",
      "--write-tree",
      "--no-messages",
      candidate,
      main,
    );
    return mergedTree === candidateTree;
  } catch {
    return false;
  }
};

test("release lineage accepts content-integrated main and rejects main-only changes", () => {
  const repository = mkdtempSync(join(tmpdir(), "pulpe-release-lineage-"));
  try {
    git(repository, "init", "--initial-branch=preview");
    git(repository, "config", "user.name", "Pulpe Test");
    git(repository, "config", "user.email", "test@pulpe.local");
    commitFile(repository, "base.txt", "base\n", "base");
    const base = git(repository, "rev-parse", "HEAD");
    commitFile(repository, "release.txt", "released\n", "release candidate");
    const previousCandidate = git(repository, "rev-parse", "HEAD");

    git(repository, "switch", "-c", "main", base);
    git(
      repository,
      "merge",
      "--no-ff",
      previousCandidate,
      "-m",
      "release merge",
    );
    const releaseMerge = git(repository, "rev-parse", "HEAD");

    git(repository, "switch", "preview");
    const candidate = commitFile(
      repository,
      "feature.txt",
      "next\n",
      "next preview feature",
    );
    assert.equal(
      mainMergeLeavesCandidateUnchanged(repository, candidate, releaseMerge),
      true,
    );

    git(repository, "switch", "main");
    const hotfix = commitFile(
      repository,
      "hotfix.txt",
      "hotfix\n",
      "main hotfix",
    );
    assert.equal(
      mainMergeLeavesCandidateUnchanged(repository, candidate, hotfix),
      false,
    );

    git(repository, "switch", "preview");
    const reconciled = commitFile(
      repository,
      "hotfix.txt",
      "hotfix\n",
      "reconcile hotfix",
    );
    assert.equal(
      mainMergeLeavesCandidateUnchanged(repository, reconciled, hotfix),
      true,
    );
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});

const validReleaseEvents = [
  { type: "staging_proven", exactSha: true },
  { type: "production_approved", humanApproval: true },
  { type: "predeploy_succeeded", exactRunAttempt: true },
  {
    type: "railway_succeeded",
    trustedDeployment: true,
    trustedStatus: true,
    exactSha: true,
    activeDeployment: true,
  },
  { type: "providers_correlated", exactSha: true },
  { type: "proof_uploaded", exactRunAttempt: true },
  { type: "publish" },
];

const runReleaseScenario = (events) =>
  events.reduce(reduceReleaseEvent, {
    state: "candidate_prepared",
    publishCount: 0,
  });

test("release state machine publishes only after every trusted exact proof", () => {
  assert.deepEqual(runReleaseScenario(validReleaseEvents), {
    state: "published",
    publishCount: 1,
  });

  for (const blockedEvent of [
    {
      type: "railway_succeeded",
      trustedDeployment: true,
      trustedStatus: false,
      exactSha: true,
      activeDeployment: true,
    },
    {
      type: "railway_succeeded",
      trustedDeployment: true,
      trustedStatus: true,
      exactSha: false,
      activeDeployment: true,
    },
    { type: "providers_correlated", exactSha: false },
    { type: "proof_uploaded", exactRunAttempt: false },
  ]) {
    const events = validReleaseEvents.map((event) =>
      event.type === blockedEvent.type ? blockedEvent : event,
    );
    assert.notEqual(runReleaseScenario(events).state, "published");
  }
});

test("release state machine recovers on a new same-SHA attempt and publishes once", () => {
  const beforeRailway = validReleaseEvents.slice(0, 3);
  const afterRailway = validReleaseEvents.slice(4);
  const result = runReleaseScenario([
    ...beforeRailway,
    { type: "railway_failed", exactSha: true },
    { type: "finalizer_skipped" },
    validReleaseEvents[3],
    { type: "railway_succeeded", ...validReleaseEvents[3] },
    ...afterRailway,
    { type: "proof_failed" },
    { type: "publish" },
  ]);

  assert.deepEqual(result, { state: "published", publishCount: 1 });
});

test("release proof keeps a successful immutable attempt after a failed rerun", () => {
  const identity = {
    path: ".github/workflows/release-gate.yml",
    event: "pull_request",
    head_branch: "release/v1.2.3",
    head_sha: "a".repeat(40),
  };
  const evidence = {
    runs: [{ id: 42, ...identity, pull_requests: [] }],
    attempts: {
      42: [
        {
          ...identity,
          run_attempt: 1,
          status: "completed",
          conclusion: "success",
        },
        {
          ...identity,
          run_attempt: 2,
          status: "completed",
          conclusion: "failure",
        },
      ],
    },
    jobs: {
      "42:1": [
        {
          id: 99,
          name: "✅ Release Gate",
          status: "completed",
          conclusion: "success",
        },
      ],
      "42:2": [
        {
          id: 101,
          name: "✅ Release Gate",
          status: "completed",
          conclusion: "failure",
        },
      ],
    },
  };

  assert.deepEqual(
    selectReleaseGateProof(evidence, identity.head_branch, identity.head_sha),
    { runId: 42, attempt: 1, jobId: 99 },
  );
  evidence.jobs["42:1"].push({ ...evidence.jobs["42:1"][0], id: 100 });
  assert.equal(
    selectReleaseGateProof(evidence, identity.head_branch, identity.head_sha),
    null,
    "ambiguous named jobs must fail closed",
  );
  evidence.jobs["42:1"].pop();
  assert.equal(
    selectReleaseGateProof(evidence, "release/v9.9.9", identity.head_sha),
    null,
    "branch drift must fail closed",
  );
  evidence.attempts[42][1].head_sha = "b".repeat(40);
  assert.equal(
    selectReleaseGateProof(evidence, identity.head_branch, identity.head_sha),
    null,
    "identity drift in a later attempt must fail closed",
  );
});

function selectSuccessfulAttempt(attempts, path, event, sha) {
  return attempts
    .filter(
      (attempt) =>
        attempt.path === path &&
        attempt.event === event &&
        attempt.head_sha === sha &&
        attempt.status === "completed" &&
        attempt.conclusion === "success",
    )
    .toSorted((left, right) =>
      left.run_id === right.run_id
        ? left.run_attempt - right.run_attempt
        : left.run_id - right.run_id,
    )
    .at(-1);
}

test("production proof keeps attempt one after a failed rerun", () => {
  const identity = {
    run_id: 42,
    path: ".github/workflows/production-finalize.yml",
    event: "deployment_status",
    head_sha: "a".repeat(40),
    status: "completed",
  };
  const selected = selectSuccessfulAttempt(
    [
      { ...identity, run_attempt: 1, conclusion: "success" },
      { ...identity, run_attempt: 2, conclusion: "failure" },
    ],
    identity.path,
    identity.event,
    identity.head_sha,
  );
  assert.equal(selected.run_attempt, 1);
});

test("Supabase archives are pinned and verified before extraction", () => {
  assert.match(
    action,
    /14659e7148ad17b77e69e5c36b27be572110519c76c796da1b53c07c3590f593/,
  );
  assert.match(
    action,
    /e2697de24a58a10820cd631dd78ae1e1ef2fe5f6625f4447ca65624dbe86072e/,
  );
  assert.match(action, /key:.*sha256/);

  const verify = action.indexOf("sha256sum --check");
  const extract = action.indexOf("tar -xzf");
  assert.notEqual(verify, -1);
  assert.notEqual(extract, -1);
  assert.ok(verify < extract, "the archive must be verified before extraction");
});

test("Supabase CLI version stays aligned across CI, local tooling, and docs", () => {
  const version = workflow.match(
    /SUPABASE_CLI_VERSION:\s*["']([^"']+)["']/,
  )?.[1];

  assert.ok(version, "the CI Supabase version must be pinned");
  assert.equal(backendPackage.devDependencies.supabase, version);
  assert.match(action, new RegExp(`${version.replaceAll(".", "\\.")}:amd64`));
  assert.match(action, new RegExp(`${version.replaceAll(".", "\\.")}:arm64`));
  assert.match(
    ciGuide,
    new RegExp(`CLI Supabase ${version.replaceAll(".", "\\.")}`),
  );
});

test("CI is PR-only and production owns migration credentials", () => {
  assert.match(workflow, /pull_request:\n\s+branches: \[preview\]/);
  assert.doesNotMatch(workflow, /^\s{2}push:|branches: \[main/m);
  assert.doesNotMatch(workflow, /secrets\.|supabase db push/);
  assert.match(
    workflow,
    /node --test \.github\/scripts\/migration-contract\.test\.mjs/,
  );
  assert.match(
    workflow,
    /check-migration-contract\.mjs "\$BASE_SHA" "\$HEAD_SHA"/,
  );
  assert.match(production, /environment: production/);
  assert.match(
    production,
    /check-migration-contract\.mjs "\$\{GITHUB_SHA\}\^1" "\$GITHUB_SHA"/,
  );
  const dryRun = production.indexOf("run: supabase db push --dry-run");
  const apply = production.indexOf("run: supabase db push\n");
  assert.notEqual(dryRun, -1);
  assert.notEqual(apply, -1);
  assert.ok(
    dryRun < apply,
    "the production dry-run must precede migration apply",
  );
});

test("successful preview PRs emit one immutable tested-tree proof", () => {
  const successStart = workflow.indexOf("\n  ci-success:");
  const success = workflow.slice(successStart);

  assert.match(success, /permissions:\n\s+contents: read/);
  assert.match(success, /HEAD_REF:.*github\.head_ref/);
  assert.match(success, /git rev-parse "\$\{HEAD_SHA\}\^".*BASE_SHA/s);
  assert.match(success, /tree_sha.*git rev-parse/s);
  assert.match(success, /"run_attempt": int\(os\.environ\["RUN_ATTEMPT"\]\)/);
  assert.match(
    success,
    /name: ci-evidence-pr-.*-run-.*-attempt-.*\n\s+path: ci-evidence\.json\n\s+retention-days: 14/,
  );
  assert.doesNotMatch(success, /secrets\./);
  assert.ok(
    success.indexOf("✅ Check all jobs") <
      success.indexOf("📤 Upload tested-tree evidence"),
    "the proof must be emitted only after the complete matrix gate",
  );
});

test("the shadow staging proof fails closed on identity or deployment drift", () => {
  assert.match(stagingProof, /on: deployment_status/);
  assert.match(
    stagingProof,
    /deployment_status\.state == 'success'.*deployment\.environment == 'pulpe-backend \/ preview'.*deployment\.creator\.login == 'railway-app\[bot\]'/s,
  );
  assert.doesNotMatch(
    stagingProof,
    /pull_request_target|secrets\.|:\s*write\b/,
  );
  assert.match(stagingProof, /actions: read/);
  assert.match(stagingProof, /deployments: read/);
  assert.match(stagingProof, /pull-requests: read/);
  assert.match(stagingProof, /timeout-minutes: 55/);
  assert.match(stagingProof, /for iteration in \{1\.\.180\}/);
  assert.match(stagingProof, /actions\/runs\/\$ci_run_id/);
  assert.match(stagingProof, /queued\|in_progress/);
  assert.match(
    stagingProof,
    /canonical CI run did not complete within 30 minutes/,
  );
  assert.match(stagingProof, /unknown canonical CI status/);
  assert.match(stagingProof, /canonical CI run failed/);
  assert.match(stagingProof, /if \[ "\$conclusion" != success \]/);
  assert.match(stagingProof, /\.run_attempt \| select\(type == "number"\)/);
  assert.match(stagingProof, /for _ in \{1\.\.120\}/);
  assert.match(stagingProof, /\.tree_sha == \$tree_sha/);
  assert.match(stagingProof, /Preview – pulpe-frontend/);
  assert.match(stagingProof, /Preview – pulpe-landing/);
  assert.match(stagingProof, /pulpe-backend \/ preview/);
  assert.match(stagingProof, /vercel\[bot\]/);
  assert.match(stagingProof, /railway-app\[bot\]/);
  assert.match(stagingProof, /preview moved from/);
  assert.match(stagingProof, /git rev-parse "\$\{GITHUB_SHA\}\^1"/);
  assert.match(stagingProof, /backend-preview-34f4\.up\.railway\.app\/health/);
  assert.match(stagingProof, /name: staging-proof-\$\{\{ github\.sha \}\}/);
  assert.ok(
    stagingProof.indexOf("canonical CI run failed") <
      stagingProof.indexOf("📥 Download tested-tree evidence"),
    "canonical CI success must be checked before evidence download",
  );
  assert.ok(
    stagingProof.indexOf("branches/preview") <
      stagingProof.indexOf(
        "canonical CI run did not complete within 30 minutes",
      ),
    "preview must remain fixed while canonical CI is pending",
  );

  for (const actionUse of stagingProof.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    assert.match(
      actionUse[1],
      /@[0-9a-f]{40}$/,
      `workflow action is not pinned: ${actionUse[1]}`,
    );
  }
});

test("release promotion writes only after a trusted immutable proof", () => {
  assert.match(releasePromotion, /workflow_dispatch:/);
  assert.match(
    releasePromotion,
    /workflow_run:\n\s+workflows: \["✅ Staging Ready \(shadow\)"\]/,
  );
  assert.doesNotMatch(releasePromotion, /^\s{2}pull_request(?:_target)?:/m);
  assert.match(releasePromotion, /actions: read/);
  assert.match(releasePromotion, /contents: read/);
  assert.match(releasePromotion, /pull-requests: read/);
  assert.doesNotMatch(
    releasePromotion,
    /:\s*write\b|--admin|enablePullRequestAutoMerge/,
  );
  assert.match(
    releasePromotion,
    /actions\/create-github-app-token@fee1f7d63c2ff003460e3d139729b119787bc349/,
  );
  assert.match(releasePromotion, /\.user\.login == "pulpe-release\[bot\]"/);
  assert.match(releasePromotion, /\.parents\[1\]\.sha == \$release/);
  assert.match(releasePromotion, /\.parents\[0\]\.sha == \$base/);
  assert.match(releasePromotion, /staging-proof-\$CANDIDATE_SHA/);
  assert.match(releasePromotion, /artifact_count.*\.expired == false/s);
  assert.match(
    releasePromotion,
    /completed staging workflow has no proof artifact/,
  );
  assert.match(releasePromotion, /-F force=false/);
  assert.match(releasePromotion, /base=preview/);
  assert.match(
    releasePromotion,
    /pulls" -f state=open -f base=preview -f head=/,
  );
  assert.match(releasePromotion, /base=main/);
  assert.match(releasePromotion, /pulls" -f state=open -f base=main -f head=/);
  assert.equal(
    releasePromotion.match(/merge-tree --write-tree --no-messages/g)?.length,
    2,
    "prepare and promote must prove the same no-op main merge",
  );
  assert.doesNotMatch(
    releasePromotion,
    /compare\/main\.\.\.|main-compare\.json/,
  );
  assert.match(
    releasePromotion,
    /main contains tracked content absent from candidate/,
  );
  assert.equal(
    releaseSkill.match(/merge-tree --write-tree --no-messages/g)?.length,
    2,
    "release preparation and handoff must use the workflow lineage invariant",
  );
  assert.doesNotMatch(releaseSkill, /merge-base --is-ancestor origin\/main/);
  assert.match(releaseSkill, /expand\/contract migration contract/);
  assert.doesNotMatch(
    releaseSkill,
    /deploys the exact production commit through Railway|synchronizes Railway's web version gate/,
  );

  for (const actionUse of releasePromotion.matchAll(
    /^\s*uses:\s*([^\s#]+)/gm,
  )) {
    assert.match(
      actionUse[1],
      /@[0-9a-f]{40}$/,
      `workflow action is not pinned: ${actionUse[1]}`,
    );
  }
});

test("the production PR gate is read-only and proof-bound", () => {
  assert.match(releaseGate, /pull_request:\n\s+branches: \[main\]/);
  assert.doesNotMatch(releaseGate, /pull_request_target/);
  assert.match(releaseGate, /actions: read/);
  assert.match(releaseGate, /contents: read/);
  assert.match(releaseGate, /pull-requests: read/);
  assert.doesNotMatch(
    releaseGate,
    /secrets\.|:\s*write\b|actions\/checkout|git checkout|pull_request\.head\.repo/,
  );
  assert.match(releaseGate, /PR_AUTHOR.*pull_request\.user\.login/);
  assert.match(releaseGate, /test "\$PR_AUTHOR" = 'pulpe-release\[bot\]'/);
  assert.match(releaseGate, /release\/v\(\[0-9\]/);
  assert.match(releaseGate, /\.merge_commit_sha == \$candidate/);
  assert.match(releaseGate, /\.parents\[1\]\.sha == \$release/);
  assert.match(releaseGate, /\.parents\[0\]\.sha == \$base/);
  assert.match(releaseGate, /\.tree_sha == \$tree/);
  assert.match(releaseGate, /\.conclusion == "success"/);
  assert.match(releaseGate, /staging-proof-\$CANDIDATE_SHA/);
  assert.match(releaseGate, /matching-refs\/tags/);
});

test("production prepares Railway without waiting for or forcing it", () => {
  assert.match(production, /push:\n\s+branches: \[main\]/);
  assert.match(production, /actions: read/);
  assert.match(production, /contents: read/);
  assert.match(production, /deployments: read/);
  assert.match(production, /pull-requests: read/);
  assert.doesNotMatch(production, /:\s*write\b|--force/);
  assert.match(production, /.user\.login == "pulpe-release\[bot\]"/);
  assert.match(production, /.state == "APPROVED"/);
  assert.match(production, /release-gate\.yml/);
  assert.match(production, /actions\/runs\/\$run_id\/attempts\/\$attempt"/);
  assert.match(production, /\.name == "✅ Release Gate"/);
  assert.match(production, /.parents\[1\]\.sha == \$candidate/);
  assert.match(production, /.parents\[0\]\.sha == \$base/);
  assert.match(production, /staging-proof-\$candidate_sha/);
  assert.doesNotMatch(
    production,
    /LATEST_WEB_VERSION|railway variable set|RAILWAY_PRODUCTION_TOKEN/,
  );
  assert.match(production, /production-context-\$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(
    production,
    /serviceInstanceDeployV2|railway redeploy|deployment list/,
  );
  assert.ok(
    production.indexOf("Verify the approved release and staging proof") <
      production.indexOf("Checkout authorized production tree"),
  );
  for (const actionUse of production.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    assert.match(actionUse[1], /^(?:\.\/|.*@[0-9a-f]{40}$)/);
  }
});

test("production finalization is event-driven, active and idempotent", () => {
  assert.match(productionFinalize, /deployment_status:/);
  assert.match(
    productionFinalize,
    /github\.event\.deployment_status\.state == 'success'/,
  );
  assert.match(productionFinalize, /pulpe-backend \/ production/);
  assert.match(productionFinalize, /railway-app\[bot\]/);
  assert.match(
    productionFinalize,
    /deployment_status\.creator\.login == 'railway-app\[bot\]'/,
  );
  assert.match(productionFinalize, /DEPLOYMENT_STATUS_ID/);
  assert.match(productionFinalize, /\.id == \$id and \.state == "success"/);
  assert.match(productionFinalize, /\.\[0\]\.status == "SUCCESS"/);
  assert.match(productionFinalize, /\.\[0\]\.meta\.commitHash == \$sha/);
  assert.match(productionFinalize, /api\/v1\/app\/version/);
  assert.match(productionFinalize, /\.data\.web\.latestVersion == \$version/);
  assert.doesNotMatch(
    productionFinalize,
    /serviceInstanceDeployV2|railway redeploy/,
  );
  assert.match(
    productionFinalize,
    /production-proof-\$\{\{ github\.event\.deployment\.sha \}\}-run-\$\{\{ github\.run_id \}\}-attempt-\$\{\{ github\.run_attempt \}\}/,
  );
  assert.match(productionFinalize, /workflow_run_id:\$workflow_run_id/);
  assert.match(productionFinalize, /run_attempt:\$run_attempt/);
  assert.match(
    productionFinalize,
    /runs\/\$candidate_run\/attempts\/\$candidate_attempt/,
  );
  assert.match(productionFinalize, /repos\/\$GITHUB_REPOSITORY\/git\/tags/);
  assert.match(productionFinalize, /repos\/\$GITHUB_REPOSITORY\/releases/);
  assert.match(productionFinalize, /Production – pulpe-frontend/);
  assert.match(productionFinalize, /Production – pulpe-landing/);
  assert.match(productionFinalize, /sha256sum --check/);
  assert.match(
    productionFinalize,
    /Authorization: Bearer \$\{POSTHOG_PERSONAL_API_KEY\}/,
  );
  assert.doesNotMatch(productionFinalize, /POST\.\.\.KEY/);
  assert.doesNotMatch(productionFinalize, /LATEST_IOS_VERSION|MIN_WEB_VERSION/);
  const railwayProof = productionFinalize.indexOf(
    "Verify active Railway production deployment",
  );
  const recordProof = productionFinalize.indexOf(
    "Record immutable production proof",
  );
  const uploadProof = productionFinalize.indexOf("Upload production proof");
  const appToken = productionFinalize.indexOf(
    "Create short-lived GitHub App token",
  );
  assert.ok(
    railwayProof < recordProof &&
      recordProof < uploadProof &&
      uploadProof < appToken,
  );
  for (const actionUse of productionFinalize.matchAll(
    /^\s*uses:\s*([^\s#]+)/gm,
  )) {
    assert.match(actionUse[1], /^(?:\.\/|.*@[0-9a-f]{40}$)/);
  }
});

test("iOS distribution consumes staging or production proofs, never push CI", () => {
  assert.match(iosDistribution, /workflow=staging-proof\.yml/);
  assert.match(iosDistribution, /workflow=production-finalize\.yml/);
  assert.match(iosDistribution, /staging-proof-\$SOURCE_SHA/);
  assert.match(
    iosDistribution,
    /production-proof-\$SOURCE_SHA-run-\$run_id-attempt-\$run_attempt/,
  );
  assert.doesNotMatch(iosDistribution, /actions\/workflows\/ci\.yml\/runs/);
  assert.match(iosDistribution, /gh run download/);
  assert.match(iosDistribution, /\.production_sha == \$sha/);
  assert.match(iosDistribution, /\.workflow_run_id == \$run/);
  assert.match(iosDistribution, /\.run_attempt == \$attempt/);
  assert.match(iosDistribution, /runs\/\$run_id\/attempts\/\$run_attempt/);
  assert.match(iosDistribution, /attempts\/\$run_attempt\/jobs/);
  assert.match(iosDistribution, /✅ Staging Ready \(shadow\)/);
  assert.match(iosDistribution, /✅ Finalize proven production/);
  assert.match(iosDistribution, /\.expired == false/);
  assert.match(iosDistribution, /\.candidate_sha == \$sha/);
  assert.match(iosDistribution, /\.staging_run_id == \$run/);
  assert.match(iosDistribution, /\.tree_sha == \$tree/);
});

test("the backend image does not install Bun", () => {
  assert.doesNotMatch(dockerfile, /bun\.sh\/install|\/root\/\.bun/);
});

test("critical dependency audit stays in CI", () => {
  assert.equal(
    rootPackage.scripts["audit:critical"],
    "pnpm audit --audit-level critical",
  );
  assert.match(workflow, /check:\s*\[[^\]]*"audit:critical"[^\]]*\]/);
});

test("the boundaries upgrade keeps a modern explicit policy", () => {
  const settings = frontendEslintConfig.find(
    (config) => config.settings?.["boundaries/dependency-nodes"],
  )?.settings;
  const rules = frontendEslintConfig.find(
    (config) => config.rules?.["boundaries/dependencies"]?.[1]?.rules,
  )?.rules;

  assert.deepEqual(settings?.["boundaries/dependency-nodes"], [
    "import",
    "dynamic-import",
  ]);
  assert.equal(settings?.["boundaries/legacy-templates"], false);
  assert.ok(rules, "the boundaries dependency policy must be configured");
  for (const deprecatedRule of [
    "boundaries/element-types",
    "boundaries/entry-point",
    "boundaries/external",
    "boundaries/no-private",
  ]) {
    assert.equal(rules[deprecatedRule], "off");
  }
  assert.doesNotMatch(JSON.stringify(rules), /\$\{/);

  const privacyRule = rules["boundaries/dependencies"][1].rules.at(-1);
  assert.deepEqual(privacyRule, {
    disallow: {
      to: { parent: { type: "*" } },
      dependency: {
        relationship: { to: [null, "!(child|sibling|uncle)"] },
      },
    },
  });
});
