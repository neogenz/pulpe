import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
const production = read(".github/workflows/production.yml");
const productionFinalize = readOptional(
  ".github/workflows/production-finalize.yml",
);
const iosDistribution = read(".github/workflows/ios-distribute.yml");
const workflowProof = read(".github/scripts/resolve-workflow-proof.mjs");
const workflowProofTest = read(
  ".github/scripts/resolve-workflow-proof.test.mjs",
);
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
  // between attempts); no second retry wraps the generation itself. The only
  // sanctioned way to drop it is the explicit skip flag, wired to the
  // DB-contract detection in the workflow.
  assert.doesNotMatch(
    startSupabase,
    /^EXCLUDE=.*postgres-meta/m,
    "postgres-meta must start inside the rate-limit retry loop",
  );
  assert.match(startSupabase, /SUPABASE_SKIP_PG_META:-0/);
  assert.match(startSupabase, /SUPABASE_START_ATTEMPTS:-3/);
  assert.match(startSupabase, /supabase stop --no-backup/);

  // Types are generated into RUNNER_TEMP, refused when empty, compared to the
  // tracked file — never written over it, and never shipped via artifact.
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
    /supabase-state/,
    "no artifact may ship Supabase state between runners",
  );
});

test("one DB runner starts one stack for SQL, types, and backend integration", () => {
  const backendDb = workflow.slice(
    workflow.indexOf("\n  backend-db:"),
    workflow.indexOf("\n  workspace:"),
  );

  // One stack, one CLI install, no artifact plumbing, parallel to workspace.
  assert.equal([...workflow.matchAll(/start-supabase\.sh/g)].length, 1);
  assert.equal(
    [...workflow.matchAll(/uses: \.\/\.github\/actions\/setup-supabase-cli/g)]
      .length,
    1,
  );
  assert.ok(backendDb.length > 0, "the backend-db job must exist");
  assert.match(
    backendDb,
    /needs: \[classify\]\n\s+if: needs\.classify\.outputs\.backend_db == 'true'/,
  );
  assert.doesNotMatch(backendDb, /download-artifact|upload-artifact/);

  // postgres-meta starts only when the PR touches the DB contract, and the
  // detection fails closed to verifying the types.
  assert.match(
    backendDb,
    /SUPABASE_SKIP_PG_META: \$\{\{ steps\.db\.outputs\.contract == 'true' && '0' \|\| '1' \}\}/,
  );
  assert.match(backendDb, /contract=true\n/);
  assert.match(backendDb, /backend-nest\/supabase\/migrations/);
  assert.match(backendDb, /backend-nest\/supabase\/config\.toml/);
  assert.match(backendDb, /backend-nest\/src\/types\/database\.types\.ts/);
  assert.match(
    backendDb,
    /Verify TypeScript Types\n\s+if: steps\.db\.outputs\.contract == 'true'/,
  );

  // Order on the shared stack: SQL suites, then types, then integration —
  // with diagnostics and cleanup surviving a red step.
  const sql = backendDb.indexOf("SQL Integration Tests");
  const types = backendDb.indexOf("Verify TypeScript Types");
  const integration = backendDb.indexOf("Run backend integration tests");
  assert.ok(sql >= 0 && sql < types && types < integration);
  assert.match(backendDb, /ON_ERROR_STOP=1/);
  assert.match(backendDb, /bun test \.integration\.spec \.e2e\.spec/);
  assert.match(backendDb, /if: failure\(\)/);
  assert.match(
    backendDb,
    /if: always\(\) && steps\.start-supabase\.outcome == 'success'/,
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

test("E2E runs both mocked projects explicitly in one runner", () => {
  const e2e = workflow.slice(
    workflow.indexOf("\n  test-e2e:"),
    workflow.indexOf("\n  actionlint:"),
  );
  assert.doesNotMatch(e2e, /strategy:|matrix:/);
  assert.match(
    e2e,
    /pnpm test:e2e --project="Critical User Journeys \(Mocked\)" --project="Feature Tests \(Mocked\)"/,
  );
  assert.doesNotMatch(e2e, /Chromium - Smoke/);
  assert.equal([...e2e.matchAll(/uses: actions\/checkout@/g)].length, 1);
  assert.equal([...e2e.matchAll(/pnpm install --frozen-lockfile/g)].length, 1);
  assert.equal([...e2e.matchAll(/playwright install chromium/g)].length, 1);
  assert.match(e2e, /name: playwright-report\n/);
});

test("CI is PR-only and production owns migration credentials", () => {
  // `main` is the trunk: feature PRs and the single preparation PR alike.
  assert.match(workflow, /pull_request:\n\s+branches: \[main\]/);
  assert.doesNotMatch(workflow, /^\s{2}push:/m);
  assert.doesNotMatch(workflow, /secrets\.|supabase db push/);
  assert.match(production, /environment: production/);
  const dryRun = production.indexOf("run: supabase db push --dry-run");
  const apply = production.indexOf("          supabase db push\n");
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
    /\n  migration-contract:[\s\S]*migration-contract\.test\.cjs[\s\S]*github\.event\.pull_request\.base\.sha[\s\S]*github\.event\.pull_request\.head\.sha[\s\S]*check-migration-contract\.cjs[\s\S]*\n  ci-success:[\s\S]*RESULT_MIGRATION: \$\{\{ needs\.migration-contract\.result \}\}[\s\S]*require "Migration Contract" "\$RESULT_MIGRATION"/,
  );
  const replay = production.indexOf("Verify migration contract");
  const dryRun = production.indexOf("run: supabase db push --dry-run");
  assert.ok(replay >= 0 && replay < dryRun);
  assert.match(
    production.slice(replay, dryRun),
    /check-migration-contract\.cjs "\$ANCHOR_SHA" "\$GITHUB_SHA"/,
  );
});

test("successful PRs to main emit one immutable tested-tree proof", () => {
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
  assert.match(stagingProof, /on:\n  push:\n    branches: \[main\]/);
  assert.doesNotMatch(stagingProof, /deployment_status/);
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
  assert.match(stagingProof, /output=\$\(gh api [^\n]+\/statuses[^\n]+ 2>&1\)/);
  assert.match(stagingProof, /elif \[\[ "\$output" == \*"HTTP 404"\* \]\]/);
  assert.match(stagingProof, /HTTP 404[\s\S]*return 0[\s\S]*return 1/);
  assert.match(stagingProof, /\.tree_sha == \$tree_sha/);
  assert.match(stagingProof, /Preview – pulpe-frontend/);
  assert.match(stagingProof, /Preview – pulpe-landing/);
  assert.match(stagingProof, /pulpe-backend \/ preview/);
  assert.match(stagingProof, /vercel\[bot\]/);
  assert.match(stagingProof, /railway-app\[bot\]/);
  assert.match(stagingProof, /main moved from/);
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
    stagingProof.indexOf("branches/main") <
      stagingProof.indexOf(
        "canonical CI run did not complete within 30 minutes",
      ),
    "main must remain fixed while canonical CI is pending",
  );

  for (const actionUse of stagingProof.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    assert.match(
      actionUse[1],
      /^(?:.*@[0-9a-f]{40}|\.\/\.github\/workflows\/production\.yml)$/,
      `workflow action is not pinned: ${actionUse[1]}`,
    );
  }
});

test("the proof resolver's own suite runs in the automation gate", () => {
  // Every release proof — staging, production authorization, iOS
  // distribution — flows through resolve-workflow-proof.mjs. Its suite was
  // never wired into a script, so it never ran in CI.
  assert.equal(
    rootPackage.scripts["test:workflow-proof"],
    "node --test .github/scripts/resolve-workflow-proof.test.mjs",
  );
  assert.match(
    rootPackage.scripts["quality:automation"],
    /test:workflow-proof/,
  );

  // A run of another intention must be skipped, not fatal: `plan` and
  // `publish` share release-promotion.yml, and a successful `plan` carries
  // none of `publish`'s jobs.
  assert.match(workflowProof, /\n {6}if \(jobs\.length === 0\) continue;\n/);
  assert.match(
    workflowProofTest,
    /ignores a newer successful run of another intention/,
  );
  assert.match(
    workflowProofTest,
    /still fails closed when the named job exists but did not succeed/,
  );
});

test("release lineage uses the shared content-integration check", () => {
  // The workflows enforce candidate == main tip; only the skill's local
  // pre-flight still needs the content-integration script.
  assert.match(
    releaseSkill,
    /node \.github\/scripts\/check-release-lineage\.mjs/,
  );
  assert.match(
    production,
    /branches\/main" --jq \.commit\.sha\)" = "\$GITHUB_SHA"/,
  );
  for (const source of [releasePromotion, production, releaseSkill]) {
    assert.doesNotMatch(
      source,
      /behind_by\s*==\s*0|git\s+merge-base\s+--is-ancestor\s+origin\/main\b/,
    );
  }
});

test("production retains essential mutation and credential boundaries", () => {
  assert.doesNotMatch(production, /:\s*write\b|--force/);
  const authorize = production
    .split("\n  authorize:")[1]
    .split("\n  migrate:")[0];
  assert.doesNotMatch(authorize, /secrets\.|environment:/);
  for (const name of ["migrate", "advance"]) {
    const job = production.split(`\n  ${name}:`)[1].split(/\n  [a-z]+:/)[0];
    assert.match(job, /environment: production/);
    assert.match(job, /branches\/main.*--jq \.commit\.sha.*GITHUB_SHA/);
  }
  assert.match(production, /needs: \[authorize, migrate\]/);
  assert.match(
    production,
    /needs\.migrate\.result == 'success' \|\| needs\.migrate\.result == 'skipped'/,
  );
  assert.match(production, /refs\/heads\/production.*-F force=false/);
  assert.ok(
    productionFinalize.indexOf("Verify active Railway production deployment") <
      productionFinalize.indexOf("Create short-lived GitHub App token"),
  );
  for (const source of [production, productionFinalize, iosDistribution]) {
    for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)/gm))
      assert.match(
        match[1],
        /^(?:\.\/\.github\/(?:workflows|actions)\/[^\s]+|[^\s]+@[0-9a-f]{40})$/,
      );
  }
  const headers = iosDistribution
    .split("\n")
    .filter((line) => line.includes("Authorization: Bearer"));
  assert.equal(headers.length, 2);
  for (const header of headers)
    assert.ok(header.includes("${POSTHOG_PERSONAL_API_KEY}"));
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

test("one macOS CI job proves units and the targeted iOS smoke", () => {
  const iosJob = workflow.slice(
    workflow.indexOf("\n  test-ios:"),
    workflow.indexOf("\n  ci-success:"),
  );
  assert.match(iosJob, /-scheme PulpeLocal/);
  assert.match(iosJob, /-scheme PulpeUITests/);
  assert.match(
    iosJob,
    /-only-testing:PulpeUITests\/BudgetOpensFromListUITests/,
  );
  assert.match(iosJob, /Executed 1 test/);
  assert.doesNotMatch(iosJob, /-scheme PulpeTests|xcodebuild build/);
  assert.equal(
    [...iosJob.matchAll(/xcodebuild test/g)].length,
    2,
    "units and smoke must remain separate, explicit xcodebuild invocations",
  );
  assert.equal([...iosJob.matchAll(/uses: actions\/checkout@/g)].length, 1);
  assert.equal(
    [...iosJob.matchAll(/uses: maxim-lobanov\/setup-xcode@/g)].length,
    1,
  );
  assert.equal([...iosJob.matchAll(/uses: actions\/cache@/g)].length, 1);
  assert.equal(
    [...iosJob.matchAll(/name: 🔨 Generate Xcode project/g)].length,
    1,
  );
  assert.ok(
    iosJob.indexOf("🧪 Run Unit Tests") <
      iosJob.indexOf("🧪 Run the smoke test") &&
      iosJob.indexOf("🧪 Run the smoke test") <
        iosJob.indexOf("🧹 Cleanup Simulator"),
  );
  assert.doesNotMatch(workflow, /\n  smoke-ios:/);

  const success = workflow.slice(workflow.indexOf("\n  ci-success:"));
  const successNeeds = success.slice(0, success.indexOf("\n    steps:"));
  assert.equal([...successNeeds.matchAll(/\btest-ios\b/g)].length, 1);
  assert.doesNotMatch(success, /smoke-ios|RESULT_SMOKE_IOS|iOS Smoke/);

  // The distributor is the only other workflow allowed to run xcodebuild.
  const workflowsDir = new URL("../workflows/", import.meta.url);
  const buildWorkflows = readdirSync(workflowsDir).filter((file) =>
    read(`.github/workflows/${file}`).includes("xcodebuild"),
  );
  assert.deepEqual(buildWorkflows.sort(), ["ci.yml", "ios-distribute.yml"]);

  // The classifier keeps routing iOS: dedicated surfaces run the unit, and
  // shared or mirrored-formula changes force the full run.
  const classifier = read(".github/scripts/classify-ci-changes.mjs");
  assert.match(classifier, /kind: "ios"/);
  assert.ok(
    classifier.includes('path.startsWith("ios/Pulpe/Domain/Formulas/")'),
  );
  assert.ok(classifier.includes('path.startsWith("shared/")'));

  const posthog = iosDistribution.indexOf("Create PostHog release");
  assert.ok(
    iosDistribution.indexOf("Submit approved App Store version once") < posthog,
  );
  assert.doesNotMatch(iosDistribution, /Create PostHog annotation/);
  assert.match(iosDistribution, /readback/);
});

test("the backend image does not install Bun", () => {
  assert.doesNotMatch(dockerfile, /bun\.sh\/install|\/root\/\.bun/);
});

test("critical dependency audit stays in CI", () => {
  assert.equal(
    rootPackage.scripts["audit:critical"],
    "pnpm audit --audit-level critical",
  );
  assert.match(workflow, /run: pnpm audit:critical\n/);
});

test("the workspace unit runs every gate once without a prewarm job", () => {
  assert.doesNotMatch(workflow, /^ {2}install:/m);
  const workspaceJob = workflow.slice(
    workflow.indexOf("\n  workspace:"),
    workflow.indexOf("\n  test-e2e:"),
  );
  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const command of [
    "pnpm install --frozen-lockfile",
    'pnpm build ${TURBO_AFFECTED:+"--affected"}',
    'pnpm test:unit ${TURBO_AFFECTED:+"--affected"}',
    'pnpm lint ${TURBO_AFFECTED:+"--affected"}',
    "pnpm format:check",
    "pnpm quality",
    "pnpm deps:check",
    "pnpm audit:critical",
  ]) {
    assert.equal(
      [
        ...workspaceJob.matchAll(
          new RegExp(`run: ${escapeRegExp(command)}\\n`, "g"),
        ),
      ].length,
      1,
      `${command} must run exactly once in the workspace unit`,
    );
  }
  assert.match(workspaceJob, /cache: "pnpm"/);
  assert.match(workspaceJob, /name: build-artifacts/);
  assert.doesNotMatch(workspaceJob, /matrix:|download-artifact/);

  const success = workflow.slice(workflow.indexOf("\n  ci-success:"));
  for (const dependency of [
    "classify",
    "automation",
    "workspace",
    "backend-db",
    "test-e2e",
    "actionlint",
    "test-ios",
    "migration-contract",
  ]) {
    assert.match(success, new RegExp(`needs\\.${dependency}\\.result`));
  }
  assert.doesNotMatch(
    success,
    /needs\.build\.|needs\.test-unit\.|needs\.quality\./,
  );
});

test("changes route through a fail-closed classifier and an explicit skip contract", () => {
  const classifier = read(".github/scripts/classify-ci-changes.mjs");

  // The trigger keeps no paths filter: the required check exists on every PR.
  const trigger = workflow.slice(0, workflow.indexOf("\njobs:"));
  assert.doesNotMatch(trigger, /paths/);

  // The classifier owns only the boundaries the package graph cannot see,
  // and every uncertain surface degrades to a full run with its reason.
  for (const marker of [
    '".github/workflows/ci.yml"',
    '".github/scripts/classify-ci-changes.mjs"',
    '".github/scripts/classify-ci-changes.test.mjs"',
    '".github/scripts/ci-security.test.mjs"',
    '"pnpm-lock.yaml"',
    '"turbo.json"',
    '".changeset/config.json"',
    '"android/app.json"',
    "ios/Pulpe/Domain/Formulas/",
    "^release\\/v\\d+\\.\\d+\\.\\d+$",
    "shared package:",
    "unknown surface:",
    "turbo graph unavailable:",
    "unknown package:",
    "affectedPackages(base:",
    "classification failed:",
  ]) {
    assert.ok(classifier.includes(marker), `classifier must keep: ${marker}`);
  }

  // The classify job resolves full history and hands validated SHAs over.
  assert.match(workflow, /\n  classify:[\s\S]{0,900}fetch-depth: 0/);
  assert.match(
    workflow,
    /classify-ci-changes\.mjs \\\n\s+--base "\$BASE_SHA" --head "\$HEAD_SHA" --head-ref "\$HEAD_REF"/,
  );

  // Every routed unit is gated by an explicit classifier output.
  assert.match(
    workflow,
    /\n  automation:[\s\S]{0,400}needs: \[classify\]\n\s+if: needs\.classify\.outputs\.automation == 'true'/,
  );
  assert.match(
    workflow,
    /\n  workspace:[\s\S]{0,400}needs: \[classify\]\n\s+if: needs\.classify\.outputs\.workspace == 'true'/,
  );
  assert.match(
    workflow,
    /\n  test-e2e:[\s\S]{0,400}needs: \[classify, workspace\]\n\s+if: needs\.classify\.outputs\.e2e == 'true'/,
  );
  assert.match(
    workflow,
    /\n  test-ios:[\s\S]{0,400}needs: \[classify\]\n\s+if: needs\.classify\.outputs\.ios == 'true'/,
  );
  assert.match(workflow, /run: pnpm quality:automation\n/);

  // The affected scope comes from the same decision, never a local guess.
  assert.match(
    workflow,
    /TURBO_SCM_BASE: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/,
  );
  assert.match(
    workflow,
    /TURBO_AFFECTED: \$\{\{ needs\.classify\.outputs\.scope == 'affected' && '1' \|\| '' \}\}/,
  );

  // ci-success accepts a skip only when the decision declares the unit not
  // required, and the decision itself lands in the tested-tree evidence.
  const success = workflow.slice(workflow.indexOf("\n  ci-success:"));
  assert.match(
    success,
    /if \[ "\$2" = "skipped" \] && \[ "\$3" = "false" \]; then return; fi/,
  );
  assert.match(success, /require "Classify" "\$RESULT_CLASSIFY"/);
  assert.match(success, /require "Workflow Lint" "\$RESULT_ACTIONLINT"/);
  for (const [label, envKey] of [
    ["Automation Gates", "AUTOMATION"],
    ["Workspace", "WORKSPACE"],
    ["Backend & Database", "BACKEND_DB"],
    ["E2E Tests", "E2E"],
    ["iOS Tests", "IOS"],
  ]) {
    assert.match(
      success,
      new RegExp(
        `routed "${label}" "\\$RESULT_${envKey}" "\\$REQUIRED_${envKey}"`,
      ),
    );
  }
  assert.match(success, /"routing": json\.loads\(os\.environ\["ROUTING"\]\)/);

  // The root gate owns the classifier's own tests, in one shared chain.
  assert.equal(
    rootPackage.scripts.quality,
    "turbo quality && pnpm quality:automation",
  );
  assert.equal(
    rootPackage.scripts["test:ci-routing"],
    "node --test .github/scripts/classify-ci-changes.test.mjs",
  );
  assert.match(rootPackage.scripts["quality:automation"], /test:ci-routing/);
  assert.match(rootPackage.scripts["quality:automation"], /test:ci-security/);
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

test("the Android production build follows the production pointer", () => {
  // `main` est le tronc : chaque merge de feature y arrive. Un build EAS
  // déclenché depuis `main` consommerait le quota du plan Free et pousserait
  // un brouillon Play à chaque feature.
  const easProduction = read("android/.eas/workflows/deploy-production.yml");
  assert.match(easProduction, /on:\n  push:\n    branches: \[production\]/);
  assert.doesNotMatch(easProduction, /branches: \[main\]/);
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
