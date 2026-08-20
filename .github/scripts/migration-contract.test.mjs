import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const CHECKER = join(
  process.cwd(),
  ".github/scripts/check-migration-contract.mjs",
);
const MIGRATIONS = "backend-nest/supabase/migrations";
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
gitEnvironment.GIT_CONFIG_COUNT = "1";
gitEnvironment.GIT_CONFIG_KEY_0 = "core.hooksPath";
gitEnvironment.GIT_CONFIG_VALUE_0 = "/dev/null";

const git = (repository, ...args) =>
  execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: gitEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

function createRepository() {
  const repository = mkdtempSync(join(tmpdir(), "pulpe-migration-contract-"));
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Contract Test");
  git(repository, "config", "user.email", "contract@example.test");
  execFileSync("mkdir", ["-p", join(repository, MIGRATIONS)]);
  writeFileSync(join(repository, "README.md"), "base\n");
  git(repository, "add", ".");
  git(repository, "commit", "-m", "base");
  git(repository, "tag", "v0.1.0");
  return repository;
}

function addMigration(repository, name, sql) {
  writeFileSync(join(repository, MIGRATIONS, name), sql);
  git(repository, "add", ".");
  git(repository, "commit", "-m", name);
}

function check(repository, base = "HEAD^", head = "HEAD") {
  return spawnSync(process.execPath, [CHECKER, base, head], {
    cwd: repository,
    encoding: "utf8",
    env: gitEnvironment,
  });
}

function withRepository(run) {
  const repository = createRepository();
  try {
    run(repository);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

test("accepts an additive expand migration", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200001_expand.sql",
      "-- pulpe:migration-phase expand\nalter table budgets add column note text;\n",
    );
    assert.equal(check(repository).status, 0);
  });
});

test("rejects destructive SQL in an expand migration", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200002_bad_expand.sql",
      "-- pulpe:migration-phase expand\nalter table budgets drop column note;\n",
    );
    const result = check(repository);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /destructive/i);
  });
});

test("rejects a required column without a default in expand", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200007_required_column.sql",
      "-- pulpe:migration-phase expand\nalter table budgets add column note text not null;\n",
    );
    const result = check(repository);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /NOT NULL.*DEFAULT/i);
  });
});

test("accepts a required column with a default in expand", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200008_defaulted_column.sql",
      "-- pulpe:migration-phase expand\nalter table budgets add column note text not null default '';\n",
    );
    assert.equal(check(repository).status, 0);
  });
});

test("rejects application code in the same release as a schema migration", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200006_expand.sql",
      "-- pulpe:migration-phase expand\nalter table budgets add column note text;\n",
    );
    execFileSync("mkdir", ["-p", join(repository, "backend-nest/src")]);
    writeFileSync(
      join(repository, "backend-nest/src/use-new-column.ts"),
      "export const noteColumn = true;\n",
    );
    git(repository, "add", ".");
    git(repository, "commit", "-m", "consume expanded schema too early");
    const result = check(repository, "HEAD~2");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /schema-only/i);
  });
});

test("rejects a contract migration without a prior release tag", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200003_early_contract.sql",
      "-- pulpe:migration-phase contract\ndrop table legacy_budget;\n",
    );
    const result = check(repository);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /safe-after/i);
  });
});

test("accepts a contract migration deferred after an ancestor release", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200004_contract.sql",
      "-- pulpe:migration-phase contract\n-- pulpe:safe-after v0.1.0\ndrop table legacy_budget;\n",
    );
    assert.equal(check(repository).status, 0);
  });
});

test("rejects edits to an existing migration", () => {
  withRepository((repository) => {
    addMigration(
      repository,
      "202608200005_existing.sql",
      "-- pulpe:migration-phase expand\ncreate table stable_budget(id uuid);\n",
    );
    git(repository, "tag", "v0.2.0");
    writeFileSync(
      join(repository, MIGRATIONS, "202608200005_existing.sql"),
      "-- pulpe:migration-phase expand\ncreate table changed_budget(id uuid);\n",
    );
    git(repository, "add", ".");
    git(repository, "commit", "-m", "edit old migration");
    const result = check(repository);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /immutable/i);
  });
});
