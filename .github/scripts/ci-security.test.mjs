import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const action = read(".github/actions/setup-supabase-cli/action.yml");
const workflow = read(".github/workflows/ci.yml");
const stagingProof = read(".github/workflows/staging-proof.yml");
const releasePromotion = read(".github/workflows/release-promotion.yml");
const releaseGate = read(".github/workflows/release-gate.yml");
const dockerfile = read("backend-nest/Dockerfile");
const rootPackage = JSON.parse(read("package.json"));
const backendPackage = JSON.parse(read("backend-nest/package.json"));
const ciGuide = read("docs/CI.md");
const frontendEslintConfig = require("../../frontend/eslint.config.js");

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

test("pull requests cannot execute production migration credentials", () => {
  assert.doesNotMatch(workflow, /^\s{2}migrate-dryrun:/m);

  const successStart = workflow.indexOf("\n  ci-success:");
  const migrateStart = workflow.indexOf("\n  migrate:");
  const annotateStart = workflow.indexOf("\n  posthog-annotate:");
  const success = workflow.slice(successStart, migrateStart);
  const migrate = workflow.slice(migrateStart, annotateStart);

  assert.doesNotMatch(success, /migrate-dryrun/);
  const dryRun = migrate.indexOf("run: supabase db push --dry-run");
  const apply = migrate.indexOf("run: supabase db push\n");
  assert.notEqual(dryRun, -1);
  assert.notEqual(apply, -1);
  assert.ok(
    dryRun < apply,
    "the production dry-run must precede migration apply",
  );
});

test("successful preview PRs emit one immutable tested-tree proof", () => {
  const successStart = workflow.indexOf("\n  ci-success:");
  const migrateStart = workflow.indexOf("\n  migrate:");
  const success = workflow.slice(successStart, migrateStart);

  assert.match(success, /permissions:\n\s+contents: read/);
  assert.match(
    success,
    /github\.event_name == 'pull_request' && github\.base_ref == 'preview'/,
  );
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
  assert.match(stagingProof, /push:\n\s+branches: \[preview\]/);
  assert.doesNotMatch(
    stagingProof,
    /pull_request_target|secrets\.|:\s*write\b/,
  );
  assert.match(stagingProof, /actions: read/);
  assert.match(stagingProof, /deployments: read/);
  assert.match(stagingProof, /pull-requests: read/);
  assert.match(stagingProof, /latest canonical CI run is not green/);
  assert.match(stagingProof, /timeout-minutes: 25/);
  assert.match(stagingProof, /for _ in \{1\.\.120\}/);
  assert.match(stagingProof, /\.tree_sha == \$tree_sha/);
  assert.match(stagingProof, /Preview – pulpe-frontend/);
  assert.match(stagingProof, /Preview – pulpe-landing/);
  assert.match(stagingProof, /pulpe-backend \/ preview/);
  assert.match(stagingProof, /vercel\[bot\]/);
  assert.match(stagingProof, /railway-app\[bot\]/);
  assert.match(stagingProof, /preview moved from/);
  assert.match(stagingProof, /backend-preview-34f4\.up\.railway\.app\/health/);
  assert.match(stagingProof, /name: staging-proof-\$\{\{ github\.sha \}\}/);

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
  assert.match(releasePromotion, /staging-proof-\$CANDIDATE_SHA/);
  assert.match(releasePromotion, /-F force=false/);
  assert.match(releasePromotion, /base=preview/);
  assert.match(releasePromotion, /base=main/);

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
  assert.match(releaseGate, /\.tree_sha == \$tree/);
  assert.match(releaseGate, /\.conclusion == "success"/);
  assert.match(releaseGate, /staging-proof-\$CANDIDATE_SHA/);
  assert.match(releaseGate, /matching-refs\/tags/);
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
