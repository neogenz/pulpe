import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const action = read(".github/actions/setup-supabase-cli/action.yml");
const workflow = read(".github/workflows/ci.yml");
const dockerfile = read("backend-nest/Dockerfile");

test("Supabase archives are pinned and verified before extraction", () => {
  assert.match(
    action,
    /620a5f6ea7b60f9b4fe112a5d72464ea0e53d04022035641674a2e6d121e0eb5/,
  );
  assert.match(
    action,
    /c660f5c9f62489f7c777cbd10a71b7af0a30bced1230783ab56713bceeaa4313/,
  );
  assert.match(action, /key:.*sha256/);

  const verify = action.indexOf("sha256sum --check");
  const extract = action.indexOf("tar -xzf");
  assert.notEqual(verify, -1);
  assert.notEqual(extract, -1);
  assert.ok(verify < extract, "the archive must be verified before extraction");
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
