import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const readOptional = (path) => {
  try {
    return read(path);
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const action = read(".github/actions/setup-supabase-cli/action.yml");
const startSupabase = read(".github/scripts/start-supabase.sh");
const workflow = read(".github/workflows/ci.yml");
const androidE2eWorkflow = read(".github/workflows/android-e2e.yml");
const stagingProof = read(".github/workflows/staging-proof.yml");
const releasePromotion = read(".github/workflows/release-promotion.yml");
const releaseGate = read(".github/workflows/release-gate.yml");
const production = read(".github/workflows/production.yml");
const productionFinalize = readOptional(
  ".github/workflows/production-finalize.yml",
);
const iosDistribution = read(".github/workflows/ios-distribute.yml");
const appStoreBuildStatus = readOptional(
  ".github/scripts/app-store-build-status.rb",
);
const dockerfile = read("backend-nest/Dockerfile");
const rootPackage = JSON.parse(read("package.json"));
const frontendPackage = JSON.parse(read("frontend/package.json"));
const landingPackage = JSON.parse(read("landing/package.json"));
const backendPackage = JSON.parse(read("backend-nest/package.json"));
const sharedPackage = JSON.parse(read("shared/package.json"));
const androidPackage = JSON.parse(read("android/package.json"));
const androidApp = JSON.parse(read("android/app.json"));
const changesetsConfig = JSON.parse(read(".changeset/config.json"));
const ciGuide = read("docs/CI.md");
const releaseSkill = read(".claude/skills/release/SKILL.md");
const jstsRelease = read(".claude/skills/release/references/jsts-release.md");
const iosRelease = read(".claude/skills/release/references/ios-release.md");
const deploymentGuide = read("docs/DEPLOYMENT.md");
const versioningGuide = read("docs/VERSIONING.md");
const backendEnvironment = read("backend-nest/src/config/environment.ts");
const backendMain = read("backend-nest/src/main.ts");
const backendEnvExample = read("backend-nest/.env.example");
const frontendEslintConfig = require("../../frontend/eslint.config.js");

const assertProductVersionInvariant = ({
  packages,
  appVersion,
  fixedGroup,
}) => {
  const expected = packages[0].version;
  assert.ok(expected, "the root product version must be present");
  for (const packageJson of packages) {
    assert.equal(
      packageJson.version,
      expected,
      `${packageJson.name} version mismatch`,
    );
  }
  assert.equal(appVersion, expected, "android/app.json version mismatch");
  assert.ok(
    fixedGroup.includes("pulpe-android"),
    "pulpe-android must remain in the fixed release group",
  );
};

test("product versions and the Android release contract stay in lockstep", () => {
  const packages = [
    rootPackage,
    frontendPackage,
    landingPackage,
    backendPackage,
    sharedPackage,
    androidPackage,
  ];
  const fixedGroup = changesetsConfig.fixed.flat();

  assertProductVersionInvariant({
    packages,
    appVersion: androidApp.expo.version,
    fixedGroup,
  });
  assert.deepEqual(changesetsConfig.privatePackages, {
    version: true,
    tag: false,
  });

  assert.throws(() =>
    assertProductVersionInvariant({
      packages: [
        ...packages.slice(0, -1),
        { name: "pulpe-android", version: "0.0.0" },
      ],
      appVersion: androidApp.expo.version,
      fixedGroup,
    }),
  );
  assert.throws(() =>
    assertProductVersionInvariant({
      packages,
      appVersion: androidApp.expo.version,
      fixedGroup: fixedGroup.filter((name) => name !== "pulpe-android"),
    }),
  );

  assert.match(releaseSkill, /android\/\*\*/);
  assert.match(
    releaseSkill,
    /git log \$BASE_REF\.\.HEAD --oneline -- android\//,
  );
  assert.match(
    releaseSkill,
    /android\/package\.json android\/app\.json android\/CHANGELOG\.md/,
  );
  assert.match(jstsRelease, /android\/app\.json/);
});

test("release instructions use only the Railway-owned production path", () => {
  assert.match(releaseSkill, /production-finalize\.yml/);
  assert.doesNotMatch(releaseSkill, /RAILWAY_PREVIEW_TOKEN/);
  assert.doesNotMatch(
    jstsRelease,
    /skip deploy: false|environment: preview, then production/,
  );
  assert.doesNotMatch(
    versioningGuide,
    /railway variables --set "LATEST_WEB_VERSION/,
  );
  for (const artifactVersionSurface of [
    production,
    releaseSkill,
    jstsRelease,
    deploymentGuide,
    versioningGuide,
    backendEnvironment,
    backendMain,
    backendEnvExample,
  ]) {
    assert.doesNotMatch(artifactVersionSurface, /LATEST_WEB_VERSION/);
  }
  for (const recovery of [
    "tag exists but the GitHub Release is missing",
    "duplicate Railway success",
    "main advances",
  ]) {
    assert.match(deploymentGuide, new RegExp(recovery, "i"));
  }
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

test("Supabase type generation pulls postgres-meta inside the retry boundary", () => {
  // Every stack image resolves from the GHCR mirror, never Public ECR.
  assert.match(
    action,
    /echo "SUPABASE_INTERNAL_IMAGE_REGISTRY=ghcr\.io" >> "\$GITHUB_ENV"/,
  );
  assert.doesNotMatch(action, /public\.ecr\.aws/);

  // postgres-meta stays inside the start retry loop (3 attempts, clean stop
  // between attempts); no second retry wraps the generation itself.
  assert.doesNotMatch(
    startSupabase,
    /^EXCLUDE=.*postgres-meta/m,
    "postgres-meta must start inside the rate-limit retry loop",
  );
  assert.match(startSupabase, /SUPABASE_START_ATTEMPTS:-3/);
  assert.match(startSupabase, /supabase stop --no-backup/);

  // Types are generated into RUNNER_TEMP, refused when empty, compared to the
  // tracked file — never written over it, and never re-shipped via artifact.
  assert.match(workflow, /generated="\$RUNNER_TEMP\/database\.types\.ts"/);
  assert.match(workflow, /trap 'rm -f "\$generated"' EXIT/);
  assert.match(
    workflow,
    /supabase gen types typescript --local > "\$generated"/,
  );
  assert.doesNotMatch(workflow, /--local > src\/types\/database\.types\.ts/);
  assert.match(workflow, /\[ ! -s "\$generated" \]/);
  assert.match(
    workflow,
    /diff -u src\/types\/database\.types\.ts "\$generated"/,
  );
  assert.doesNotMatch(
    workflow,
    /supabase-state[\s\S]{0,220}database\.types\.ts/,
    "the state artifact must not ship a rewritten types file",
  );
});

test("the main CI token is read-only and E2E diagnostics stay native", () => {
  const workflowPermissions = workflow.match(
    /^permissions:\n((?:[ ]{2}.+\n)+)/m,
  )?.[1];
  assert.equal(
    workflowPermissions,
    "  contents: read\n",
    "ci.yml must grant only contents: read at the workflow level",
  );
  assert.doesNotMatch(workflow, /checks:\s*write/);
  assert.doesNotMatch(workflow, /pull-requests:\s*write/);
  assert.doesNotMatch(workflow, /permissions:\s*(?:write-all|read-all)/);
  assert.doesNotMatch(workflow, /publish-unit-test-result-action/);

  const playwrightConfig = read("frontend/playwright.config.ts");
  assert.match(playwrightConfig, /\['blob'\]/);
  assert.match(playwrightConfig, /\['github'\]/);
  assert.match(
    playwrightConfig,
    /\['junit', \{ outputFile: 'test-results\/junit\.xml' \}\]/,
  );
  assert.match(
    workflow,
    /Upload E2E artifacts\n\s+if: always\(\)[\s\S]{0,400}playwright-report\/[\s\S]{0,80}test-results\//,
    "E2E diagnostics must stay uploaded even when the tests fail",
  );
});

test("CI is PR-only and production owns migration credentials", () => {
  assert.match(workflow, /pull_request:\n\s+branches: \[preview\]/);
  assert.doesNotMatch(workflow, /^\s{2}push:|branches: \[main/m);
  assert.doesNotMatch(workflow, /secrets\.|supabase db push/);
  assert.match(production, /environment: production/);
  const dryRun = production.indexOf("run: supabase db push --dry-run");
  const apply = production.indexOf("run: supabase db push\n");
  assert.notEqual(dryRun, -1);
  assert.notEqual(apply, -1);
  assert.ok(
    dryRun < apply,
    "the production dry-run must precede migration apply",
  );
});

test("the migration contract is required and replayed before production apply", () => {
  assert.match(
    workflow,
    /\n  migration-contract:[\s\S]*migration-contract\.test\.cjs[\s\S]*github\.event\.pull_request\.base\.sha[\s\S]*github\.event\.pull_request\.head\.sha[\s\S]*check-migration-contract\.cjs[\s\S]*\n  ci-success:[\s\S]*migration-contract[\s\S]*needs\.migration-contract\.result\s*==\s*'success'[\s\S]*needs\.migration-contract\.result\s*!=\s*'success'/,
  );
  const replay = production.indexOf("Verify migration contract");
  const dryRun = production.indexOf("run: supabase db push --dry-run");
  assert.ok(replay >= 0 && replay < dryRun);
  assert.match(
    production.slice(replay, dryRun),
    /check-migration-contract\.cjs "\$\{GITHUB_SHA\}\^1" "\$GITHUB_SHA"/,
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
  assert.match(
    stagingProof,
    /name: staging-proof-\$\{\{ github\.sha \}\}-run-\$\{\{ github\.run_id \}\}-attempt-\$\{\{ github\.run_attempt \}\}/,
  );
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
    /actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/,
  );
  assert.match(releasePromotion, /permissions:[\s\S]*pull-requests: read/);
  assert.doesNotMatch(releasePromotion, /pull-requests: write/);
  assert.match(releasePromotion, /workflow_run:[\s\S]*branches: \[preview\]/);
  const validationJob = releasePromotion.slice(
    releasePromotion.indexOf("\n  validate:"),
    releasePromotion.indexOf("\n  promote:"),
  );
  const privilegedPromotion = releasePromotion.slice(
    releasePromotion.indexOf("\n  promote:"),
  );
  assert.match(validationJob, /Checkout trusted release automation/);
  assert.match(validationJob, /persist-credentials: false/);
  assert.doesNotMatch(validationJob, /secrets\.|:\s*write\b/);
  assert.match(privilegedPromotion, /needs: validate/);
  assert.doesNotMatch(
    privilegedPromotion,
    /actions\/checkout|git (?:fetch|pull|checkout|switch|reset|worktree)|gh run download|uses: \.\//,
  );
  assert.doesNotMatch(
    releasePromotion,
    /git fetch[^\n]*(?:CANDIDATE_SHA|RELEASE_SHA|release_sha)|ref:.*workflow_run\.head_sha/,
  );
  assert.match(releasePromotion, /\.user\.login == "pulpe-release\[bot\]"/);
  assert.match(releasePromotion, /\.parents\[1\]\.sha == \$release/);
  assert.match(releasePromotion, /\.parents\[0\]\.sha == \$base/);
  assert.match(
    releasePromotion,
    /--workflow staging-proof\.yml[\s\S]*--job "✅ Staging Ready \(shadow\)"[\s\S]*--artifact-template "staging-proof-\{sha\}-run-\{run_id\}-attempt-\{attempt\}"/,
  );
  assert.match(releasePromotion, /-F force=false/);
  assert.match(releasePromotion, /base=preview/);
  assert.match(
    releasePromotion,
    /pulls" -f state=open -f base=preview -f head=/,
  );
  assert.match(releasePromotion, /base=main/);
  assert.match(releasePromotion, /pulls" -f state=open -f base=main -f head=/);
  assert.match(
    releasePromotion,
    /pulls" -f state=open -f base=main -f per_page=100[\s\S]*pulpe-release\[bot\][\s\S]*startswith\("release\/"\)/,
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

test("release lineage uses the shared content-integration check", () => {
  const lineageSources = [
    releasePromotion,
    releaseGate,
    production,
    releaseSkill,
  ];
  for (const source of lineageSources) {
    assert.match(source, /node \.github\/scripts\/check-release-lineage\.mjs/);
    assert.doesNotMatch(
      source,
      /behind_by\s*==\s*0|git\s+merge-base\s+--is-ancestor\s+origin\/main\b/,
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
    /secrets\.|:\s*write\b|git checkout|pull_request\.head\.repo/,
  );
  assert.match(
    releaseGate,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/,
  );
  assert.match(
    releaseGate,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(releaseGate, /persist-credentials: false/);
  assert.match(releaseGate, /PR_AUTHOR.*pull_request\.user\.login/);
  assert.match(releaseGate, /test "\$PR_AUTHOR" = 'pulpe-release\[bot\]'/);
  assert.match(releaseGate, /release\/v\(\[0-9\]/);
  assert.match(releaseGate, /\.merge_commit_sha == \$candidate/);
  assert.match(releaseGate, /\.parents\[1\]\.sha == \$release/);
  assert.match(releaseGate, /\.parents\[0\]\.sha == \$base/);
  assert.match(releaseGate, /\.tree_sha == \$tree/);
  assert.match(
    releaseGate,
    /--workflow staging-proof\.yml[\s\S]*--job "✅ Staging Ready \(shadow\)"[\s\S]*--artifact-template "staging-proof-\{sha\}-run-\{run_id\}-attempt-\{attempt\}"/,
  );
  assert.match(
    releaseGate,
    /node \.github\/scripts\/resolve-workflow-proof\.mjs --published-main "\$current_main"/,
  );
  assert.match(releaseGate, /matching-refs\/tags/);
  assert.ok(
    releaseGate.includes(
      'gh api -X GET "repos/$GITHUB_REPOSITORY/contents/package.json" -f ref="$CANDIDATE_SHA"',
    ),
  );
});

test("production finishes preflight before Railway deploys", () => {
  assert.match(production, /push:\n\s+branches: \[main\]/);
  assert.match(production, /actions: read/);
  assert.match(production, /contents: read/);
  assert.match(production, /pull-requests: read/);
  assert.doesNotMatch(production, /:\s*write\b|--force/);
  assert.match(production, /.user\.login == "pulpe-release\[bot\]"/);
  assert.match(production, /.state == "APPROVED"/);
  assert.match(production, /release-gate\.yml/);
  assert.doesNotMatch(production, /\.pull_requests\[\]|\.pull_requests\[\]\?/);
  assert.match(
    production,
    /node \.github\/scripts\/resolve-workflow-proof\.mjs[\s\S]*--workflow release-gate\.yml[\s\S]*--sha "\$candidate_sha"[\s\S]*--job "✅ Release Gate"/,
  );
  assert.match(
    production,
    /--workflow staging-proof\.yml[\s\S]*--job "✅ Staging Ready \(shadow\)"[\s\S]*--artifact-template "staging-proof-\{sha\}-run-\{run_id\}-attempt-\{attempt\}"/,
  );
  assert.doesNotMatch(production, /gate-candidates|for run_id in/);
  assert.match(production, /environment: production/);
  assert.match(production, /run: supabase db push --dry-run/);
  assert.match(production, /run: supabase db push\n/);
  assert.doesNotMatch(
    production,
    /RAILWAY_PRODUCTION_TOKEN|RAILWAY_CLI_VERSION|railway variable set/,
  );
  assert.match(
    production,
    /name: production-context-\$\{\{ github\.sha \}\}-run-\$\{\{ github\.run_id \}\}-attempt-\$\{\{ github\.run_attempt \}\}/,
  );
  assert.match(
    production,
    /release_gate:\{run_id:\$gate_run_id,attempt:\$gate_attempt,job_id:\$gate_job_id\}/,
  );
  assert.doesNotMatch(
    production,
    /serviceInstanceDeployV2|railway redeploy|railway deployment list|Wait for exact Vercel|Create short-lived GitHub App token|git\/tags|repos\/\$GITHUB_REPOSITORY\/releases|PostHog|Content-Security-Policy/,
  );
  const authorizeJob = production.slice(
    production.indexOf("\n  authorize:"),
    production.indexOf("\n  migrate:"),
  );
  assert.doesNotMatch(authorizeJob, /secrets\.|environment:/);
  assert.ok(
    authorizeJob.indexOf("Checkout release automation without credentials") <
      authorizeJob.indexOf("Verify the approved release and staging proof"),
    "candidate automation may run only in the unprivileged authorization job",
  );
  assert.ok(
    production.indexOf("run: supabase db push\n") <
      production.indexOf("Upload authorized production context"),
    "the context must be emitted only after migrations succeed",
  );
  assert.ok(
    production.indexOf("Production – pulpe-frontend") <
      production.indexOf("Upload authorized production context"),
    "the web client must be public before Railway receives its context",
  );

  for (const actionUse of production.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    assert.match(actionUse[1], /^(?:\.\/|.*@[0-9a-f]{40}$)/);
  }
});

test("production finalizer proves exact providers before idempotent publication", () => {
  assert.match(productionFinalize, /on:\n\s+deployment_status:/);
  assert.match(
    productionFinalize,
    /group: production-finalize-\$\{\{ github\.event\.deployment\.sha \}\}/,
  );
  assert.match(productionFinalize, /railway-app\[bot\]/);
  assert.match(productionFinalize, /pulpe-backend \/ production/);
  assert.match(
    productionFinalize,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(
    productionFinalize,
    /DEPLOYMENT_REF: \$\{\{ github\.event\.deployment\.ref \}\}/,
  );
  assert.doesNotMatch(
    productionFinalize,
    /test "\$\{\{ github\.event\.deployment\.ref \}\}"/,
  );
  assert.match(productionFinalize, /deployments\/\$DEPLOYMENT_ID\/statuses/);
  assert.match(productionFinalize, /\.ref == \$sha/);
  assert.match(
    productionFinalize,
    /https:\/\/railway\.com\/project\/33ba829c-d4d6-4096-b0dc-57c89c367063\?environmentId=a28b6826-ecbe-4c0f-9856-e0ba3ce14e93/,
  );
  assert.doesNotMatch(
    productionFinalize,
    /github\.event\.deployment\.ref \}\}" = main|\.ref == "main"/,
  );
  const vercelState = productionFinalize.slice(
    productionFinalize.indexOf("state() {"),
    productionFinalize.indexOf("for _ in {1..60}"),
  );
  assert.ok(
    vercelState.indexOf("max_by(.id)") < vercelState.indexOf("environment_url"),
    "Vercel URL checks must apply to the latest bot status",
  );
  assert.match(
    productionFinalize,
    /node \.github\/scripts\/resolve-workflow-proof\.mjs[\s\S]*--workflow production\.yml[\s\S]*--sha "\$PRODUCTION_SHA"[\s\S]*--artifact-template "production-context-\{sha\}-run-\{run_id\}-attempt-\{attempt\}"/,
  );
  assert.doesNotMatch(productionFinalize, /branches\/main/);

  const verifyJob = productionFinalize.slice(
    productionFinalize.indexOf("\n  verify:"),
    productionFinalize.indexOf("\n  publish:"),
  );
  const publishJob = productionFinalize.slice(
    productionFinalize.indexOf("\n  publish:"),
  );
  assert.doesNotMatch(verifyJob, /secrets\.|environment: production/);
  assert.match(publishJob, /needs: verify/);
  assert.match(publishJob, /environment: production/);
  assert.doesNotMatch(publishJob, /actions\/checkout/);
  assert.match(publishJob, /\.\[0\]\.status == "SUCCESS"/);
  assert.match(publishJob, /\.\[0\]\.meta\.commitHash == \$sha/);
  assert.match(publishJob, /\.\[0\]\.meta\.branch == "main"/);
  assert.match(productionFinalize, /Production – pulpe-frontend/);
  assert.match(productionFinalize, /Production – pulpe-landing/);
  assert.match(productionFinalize, /https:\/\/app\.pulpe\.app\//);
  assert.match(productionFinalize, /https:\/\/pulpe\.app\//);
  assert.match(productionFinalize, /https:\/\/api\.pulpe\.app\/health/);
  assert.match(productionFinalize, /\.status == "healthy"/);
  assert.match(productionFinalize, /api\/v1\/app\/version/);
  assert.match(
    publishJob,
    /actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/,
  );
  assert.match(publishJob, /git\/tags/);
  assert.match(
    publishJob,
    /\.tag == \$tag and \.object\.type == "commit" and \.object\.sha == \$sha/,
  );
  assert.match(publishJob, /releases\?per_page=100/);
  assert.match(publishJob, /--arg body "\$body"/);
  assert.match(publishJob, /-X POST "repos\/\$GITHUB_REPOSITORY\/releases"/);
  assert.match(
    publishJob,
    /name: production-proof-\$\{\{ fromJSON\(needs\.verify\.outputs\.context\)\.production_sha \}\}-run-\$\{\{ github\.run_id \}\}-attempt-\$\{\{ github\.run_attempt \}\}/,
  );
  assert.doesNotMatch(
    productionFinalize,
    /serviceInstanceDeployV2|railway redeploy|Content-Security-Policy|POSTHOG/,
  );
  assert.ok(
    publishJob.indexOf("Verify active Railway production deployment") <
      publishJob.indexOf("Create short-lived GitHub App token"),
    "publication credentials must follow all provider proof",
  );
  for (const actionUse of productionFinalize.matchAll(
    /^\s*uses:\s*([^\s#]+)/gm,
  )) {
    assert.match(actionUse[1], /^(?:\.\/|.*@[0-9a-f]{40}$)/);
  }
});

test("iOS distribution serializes allocation and upload across channels", () => {
  const concurrency = iosDistribution.slice(
    iosDistribution.indexOf("\nconcurrency:"),
    iosDistribution.indexOf("\npermissions:"),
  );
  assert.match(concurrency, /group: ios-distribution\n/);
  assert.doesNotMatch(concurrency, /inputs\.channel/);
  assert.match(concurrency, /cancel-in-progress: false/);
});

test("iOS archive uses the imported App Store profiles without automatic provisioning", () => {
  const archive = iosDistribution.slice(
    iosDistribution.indexOf("Archive signed application"),
    iosDistribution.indexOf("Export signed IPA"),
  );

  assert.match(archive, /CODE_SIGN_STYLE=Manual/);
  assert.match(
    archive,
    /PULPE_APP_PROVISIONING_PROFILE_SPECIFIER="Pulpe App Store CI"/,
  );
  assert.match(
    archive,
    /PULPE_WIDGET_PROVISIONING_PROFILE_SPECIFIER="Pulpe Widget App Store CI"/,
  );
  assert.doesNotMatch(
    archive,
    /CODE_SIGN_STYLE=Automatic|-allowProvisioningUpdates|-authenticationKey(?:Path|ID|IssuerID)/,
  );
  const signing = iosDistribution.slice(
    iosDistribution.indexOf("Configure manual App Store signing"),
    iosDistribution.indexOf("Generate Xcode project"),
  );
  assert.match(signing, /PULPE_APP_PROVISIONING_PROFILE_SPECIFIER/);
  assert.match(signing, /PULPE_WIDGET_PROVISIONING_PROFILE_SPECIFIER/);
  assert.match(signing, /PROVISIONING_PROFILE_SPECIFIER/);
  assert.ok(
    iosDistribution.indexOf("Configure manual App Store signing") <
      iosDistribution.indexOf("Generate Xcode project"),
  );
});

test("iOS release recovery from preview is bound to an exact annotated release tag", () => {
  const validation = iosDistribution.slice(
    iosDistribution.indexOf("Validate source and distribution inputs"),
    iosDistribution.indexOf(
      "Require immutable deployment proof for source SHA",
    ),
  );

  assert.match(validation, /tagged_release_recovery=false/);
  assert.match(
    validation,
    /CHANNEL" = release.*GITHUB_REF_NAME" = preview.*tagged_release_recovery=true/s,
  );
  assert.match(validation, /release_version=.*\.\.\/package\.json/);
  assert.match(validation, /recovery_tag="refs\/tags\/v\$release_version"/);
  assert.match(validation, /git cat-file -t "\$recovery_tag".*!= tag/s);
  assert.match(
    validation,
    /git rev-parse "\$recovery_tag\^\{commit\}".*!= "\$SOURCE_SHA"/s,
  );
  assert.match(validation, /Require exact annotated release tag for recovery/);
  assert.match(
    iosDistribution,
    /resolve-ios-distribution-intent\.mjs[\s\S]*--automation-branch "\$GITHUB_REF_NAME"/,
  );
});

test("iOS distribution consumes staging or finalized production proofs", () => {
  assert.equal(
    [
      ...iosDistribution.matchAll(
        /node \.\.\/\.github\/scripts\/resolve-workflow-proof\.mjs/g,
      ),
    ].length,
    2,
  );
  assert.match(iosDistribution, /--workflow staging-proof\.yml/);
  assert.match(iosDistribution, /--workflow production-finalize\.yml/);
  assert.match(
    iosDistribution,
    /staging-proof-\{sha\}-run-\{run_id\}-attempt-\{attempt\}/,
  );
  assert.match(
    iosDistribution,
    /production-proof-\{sha\}-run-\{run_id\}-attempt-\{attempt\}/,
  );
  assert.doesNotMatch(iosDistribution, /workflow=production\.yml/);
  assert.doesNotMatch(iosDistribution, /actions\/workflows\/ci\.yml\/runs/);
  assert.doesNotMatch(iosDistribution, /gh run download/);
});

test("internal production-config builds stay bound to preview staging proof", () => {
  assert.match(iosDistribution, /options:\n\s+- internal\n\s+- release/);
  assert.match(
    iosDistribution,
    /internal\)\n\s+expected_branch="preview"\n\s+scheme="PulpeProd"\n\s+configuration="Prod"/,
  );
  assert.match(
    iosDistribution,
    /release\)\n\s+expected_branch="main"\n\s+scheme="PulpeProd"\n\s+configuration="Prod"/,
  );
  assert.match(
    iosDistribution,
    /internal\)\n\s+node [^\n]+resolve-workflow-proof\.mjs \\\n\s+--workflow staging-proof\.yml/,
  );
  assert.match(
    iosDistribution,
    /release\)\n\s+node [^\n]+resolve-workflow-proof\.mjs \\\n\s+--workflow production-finalize\.yml/,
  );
  assert.match(
    iosDistribution,
    /if \[ "\$CHANNEL" != "release" \] && \[ "\$BUILD_NUMBER" -lt "\$project_build" \]/,
  );
  assert.doesNotMatch(
    iosDistribution,
    /internal-prod|PulpePreview|configuration="Preview"/,
  );
  assert.match(
    iosRelease,
    /internal.*preview.*PulpeProd.*Prod.*selected marketing version/,
  );
  assert.doesNotMatch(
    iosRelease,
    /global ASC build|highest existing build \+ 1/,
  );
  assert.doesNotMatch(iosRelease, /PulpePreview|archive .*Preview/);
  assert.doesNotMatch(iosDistribution, /--submit|MVP/);
});

test("iOS distribution resumes the exact App Store build idempotently", () => {
  assert.match(appStoreBuildStatus, /appstoreconnect-v1/);
  assert.match(iosDistribution, /git merge-base --is-ancestor "\$SOURCE_SHA"/);
  assert.doesNotMatch(iosDistribution, /remote_sha.*!=.*SOURCE_SHA/s);
  const query = iosDistribution.indexOf("Query exact App Store build");
  const versionPreflight = iosDistribution.indexOf(
    "Verify marketing version accepts new builds",
  );
  const buildNumberPreflight = iosDistribution.indexOf(
    "Verify next build number for marketing version",
  );
  const provenance = iosDistribution.indexOf(
    "Verify existing App Store build provenance",
  );
  const archive = iosDistribution.indexOf("Archive signed application");
  const verifyIpa = iosDistribution.indexOf(
    "Verify exported application identity",
  );
  const createIntent = iosDistribution.indexOf(
    "Create iOS distribution intent",
  );
  const uploadIntent = iosDistribution.indexOf(
    "Upload iOS distribution intent",
  );
  const upload = iosDistribution.indexOf("Upload to App Store Connect");
  const proof = iosDistribution.indexOf("Create iOS distribution proof");
  assert.ok(query >= 0 && query < archive);
  assert.ok(query < versionPreflight && versionPreflight < archive);
  assert.ok(
    versionPreflight < buildNumberPreflight && buildNumberPreflight < archive,
  );
  assert.ok(buildNumberPreflight < provenance && provenance < archive);
  assert.ok(
    verifyIpa < createIntent &&
      createIntent < uploadIntent &&
      uploadIntent < upload &&
      upload < proof,
  );
  assert.match(
    iosDistribution,
    /Verify marketing version accepts new builds[\s\S]*if: steps\.asc\.outputs\.state == 'not_found'[\s\S]*--marketing-version-status/,
  );
  assert.match(iosDistribution, /ASC_INITIAL_STATE.*not_found/);
  assert.match(
    iosDistribution,
    /Verify next build number for marketing version[\s\S]*if: steps\.asc\.outputs\.state == 'not_found'[\s\S]*--next-build-number[\s\S]*BUILD_NUMBER/,
  );
  assert.match(
    iosDistribution,
    /Verify existing App Store build provenance[\s\S]*if: steps\.asc\.outputs\.state != 'not_found'[\s\S]*resolve-ios-distribution-intent\.mjs/,
  );
  assert.match(
    iosDistribution,
    /Upload iOS distribution intent[\s\S]*if: steps\.asc\.outputs\.state == 'not_found'[\s\S]*ios-distribution-intent-/,
  );
  assert.match(iosDistribution, /Poll App Store build processing/);
  assert.match(iosDistribution, /ios-distribution-proof-/);
  for (const field of ["marketing_version", "build_number", "source_sha"])
    assert.match(iosDistribution, new RegExp(`"${field}"`));
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

test("Android E2E verifies Maestro and withholds preview secrets from forks", () => {
  assert.match(
    androidE2eWorkflow,
    /pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(androidE2eWorkflow, /environment: Preview/);
  assert.match(
    androidE2eWorkflow,
    /a4ccab6b604617e7aef6db4f885666056eabe5cfa32befaa3bc994041b8fcbb5/,
  );

  const download = androidE2eWorkflow.indexOf("curl --fail");
  const verify = androidE2eWorkflow.indexOf("sha256sum --check");
  const extract = androidE2eWorkflow.indexOf("unzip -q");
  assert.ok(download < verify && verify < extract);
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
