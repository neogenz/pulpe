#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";

const MIGRATIONS = "backend-nest/supabase/migrations";
const PHASE = /^-- pulpe:migration-phase (expand|contract)\s*$/m;
const SAFE_AFTER = /^-- pulpe:safe-after (v\d+\.\d+\.\d+)\s*$/m;
const RUNTIME_PATH =
  /^(?:backend-nest\/src|frontend\/projects|landing\/(?:app|components|lib)|shared\/src)\//;
const TEST_PATH =
  /(?:^|\/)(?:test|tests|__tests__)\/|\.(?:spec|test)\.[cm]?[jt]sx?$/;
const DESTRUCTIVE_PATTERNS = [
  [
    "DROP schema object",
    /\bDROP\s+(?:TABLE|VIEW|MATERIALIZED\s+VIEW|FUNCTION|PROCEDURE|TYPE|SCHEMA)\b/i,
  ],
  [
    "DROP/RENAME column",
    /\bALTER\s+TABLE\b[\s\S]*?\b(?:DROP\s+(?:COLUMN|CONSTRAINT)|RENAME\s+(?:COLUMN|TO))\b/i,
  ],
  [
    "incompatible column alteration",
    /\bALTER\s+TABLE\b[\s\S]*?\bALTER\s+COLUMN\b[\s\S]*?\b(?:TYPE|SET\s+NOT\s+NULL)\b/i,
  ],
  ["TRUNCATE", /\bTRUNCATE(?:\s+TABLE)?\b/i],
  ["DELETE data", /\bDELETE\s+FROM\b/i],
];

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitSucceeds(...args) {
  return spawnSync("git", args, { stdio: "ignore" }).status === 0;
}

function stripNonExecutableSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)\$[\s\S]*?\$\1\$/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/'(?:''|[^'])*'/g, " ");
}

function changedMigrations(base, head) {
  const baseline = git("merge-base", base, head);
  const output = git(
    "diff",
    "--name-status",
    "--find-renames",
    baseline,
    head,
    "--",
    `${MIGRATIONS}/`,
  );
  const runtimeFiles = git("diff", "--name-only", baseline, head)
    .split("\n")
    .filter((path) => RUNTIME_PATH.test(path) && !TEST_PATH.test(path));
  if (!output) return { baseline, files: [], runtimeFiles };

  const files = output.split("\n").map((line) => {
    const [status, ...paths] = line.split("\t");
    return { status, paths };
  });
  return { baseline, files, runtimeFiles };
}

function validateMigration(path, sql, baseline) {
  const phase = sql.match(PHASE)?.[1];
  if (!phase) {
    throw new Error(
      `${path}: declare "-- pulpe:migration-phase expand" or "contract"`,
    );
  }

  if (phase === "expand") {
    const executableSql = stripNonExecutableSql(sql);
    const requiredColumnWithoutDefault = executableSql
      .split(";")
      .find(
        (statement) =>
          /\bALTER\s+TABLE\b[\s\S]*?\bADD\s+(?:COLUMN\s+)?\b/i.test(
            statement,
          ) &&
          /\bNOT\s+NULL\b/i.test(statement) &&
          !/\bDEFAULT\b/i.test(statement),
      );
    if (requiredColumnWithoutDefault) {
      throw new Error(
        `${path}: expand cannot ADD a NOT NULL column without DEFAULT`,
      );
    }
    const destructive = DESTRUCTIVE_PATTERNS.find(([, pattern]) =>
      pattern.test(executableSql),
    );
    if (destructive) {
      throw new Error(
        `${path}: destructive ${destructive[0]} is forbidden in an expand migration`,
      );
    }
    return;
  }

  const safeAfter = sql.match(SAFE_AFTER)?.[1];
  if (!safeAfter) {
    throw new Error(
      `${path}: contract migrations require "-- pulpe:safe-after vX.Y.Z"`,
    );
  }
  const tagRef = `refs/tags/${safeAfter}^{commit}`;
  if (
    !gitSucceeds("rev-parse", "--verify", "--quiet", tagRef) ||
    !gitSucceeds("merge-base", "--is-ancestor", tagRef, baseline)
  ) {
    throw new Error(
      `${path}: safe-after tag ${safeAfter} must be a published ancestor release`,
    );
  }
}

function main() {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) {
    throw new Error("usage: check-migration-contract.mjs <base> <head>");
  }

  const { baseline, files, runtimeFiles } = changedMigrations(base, head);
  if (files.length > 0 && runtimeFiles.length > 0) {
    throw new Error(
      `migration releases must be schema-only; runtime changes found: ${runtimeFiles.join(", ")}`,
    );
  }
  for (const { status, paths } of files) {
    if (status !== "A") {
      throw new Error(
        `${paths.join(" -> ")}: published migrations are immutable (${status})`,
      );
    }
    const path = paths[0];
    validateMigration(path, git("show", `${head}:${path}`), baseline);
  }
  process.stdout.write(
    `Migration contract valid (${files.length} new file(s)).\n`,
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`Migration contract failed: ${error.message}\n`);
  process.exitCode = 1;
}
