import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const action = read(".github/actions/setup-supabase-cli/action.yml");
const workflow = read(".github/workflows/ci.yml");
const dockerfile = read("backend-nest/Dockerfile");
const rootPackage = JSON.parse(read("package.json"));
const backendPackage = JSON.parse(read("backend-nest/package.json"));
const ciGuide = read("docs/CI.md");

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

test("the backend image does not install Bun", () => {
  assert.doesNotMatch(dockerfile, /bun\.sh\/install|\/root\/\.bun/);
});

test("critical production dependency audit stays in CI", () => {
  assert.equal(
    rootPackage.scripts["audit:prod:critical"],
    "pnpm audit --prod --audit-level critical",
  );
  assert.match(workflow, /check:\s*\[[^\]]*"audit:prod:critical"[^\]]*\]/);
});
