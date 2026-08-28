#!/usr/bin/env node
// Classify a pull request's changes into the CI units that must run.
//
// The classifier owns only the boundaries the Turborepo graph cannot see:
// GitHub automation, iOS, the formula mirror, release branches, and the
// sensitive root contracts. Everything inside a pnpm package is delegated to
// `turbo query` so the existing package graph stays the single source of
// dependency truth. Every unknown, ambiguous, or failing input degrades to a
// full run with its reason — the only way to skip a unit is an explicit,
// provable class.
import { execFileSync } from "node:child_process";

const UNITS = ["automation", "workspace", "backend_db", "e2e", "ios"];

const RELEASE_BRANCH = /^release\/v\d+\.\d+\.\d+$/;

// A PR editing the routing machinery or the invariants that watch it must
// prove itself on a complete run.
const SELF_PATHS = new Set([
  ".github/workflows/ci.yml",
  ".github/scripts/classify-ci-changes.mjs",
  ".github/scripts/classify-ci-changes.test.mjs",
  ".github/scripts/ci-security.test.mjs",
]);

// Root files that carry cross-cutting contracts (dependency graph, version
// lockstep, task graph). Any of them invalidates every routing shortcut.
const ROOT_CONTRACTS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  ".changeset/config.json",
  "android/app.json",
]);

const PACKAGE_PREFIXES = ["frontend/", "backend-nest/", "landing/", "android/"];

const PACKAGE_UNITS = new Map([
  ["pulpe-frontend", ["workspace", "e2e"]],
  ["backend-nest", ["workspace", "backend_db"]],
  ["pulpe-landing", ["workspace"]],
  ["pulpe-android", ["workspace"]],
]);

const fullUnits = () => Object.fromEntries(UNITS.map((unit) => [unit, true]));

const emptyUnits = () => Object.fromEntries(UNITS.map((unit) => [unit, false]));

export const fullDecision = (reason) => ({
  decision: "full",
  scope: "full",
  reason,
  units: fullUnits(),
});

export function classifyPath(path) {
  if (SELF_PATHS.has(path))
    return { kind: "full", reason: `self-modification: ${path}` };
  if (ROOT_CONTRACTS.has(path))
    return { kind: "full", reason: `root contract: ${path}` };
  if (path.startsWith("ios/Pulpe/Domain/Formulas/"))
    return { kind: "full", reason: `formula mirror: ${path}` };
  if (path.startsWith("shared/"))
    return { kind: "full", reason: `shared package: ${path}` };
  // Ces fichiers s'exécutent DANS les jobs runtime (setup-supabase-cli et
  // start-supabase.sh dans backend-db) : l'unité automation ne les prouve que
  // statiquement, seul un run complet exerce leur comportement.
  if (
    path.startsWith(".github/actions/") ||
    path === ".github/scripts/start-supabase.sh"
  )
    return { kind: "full", reason: `runtime CI dependency: ${path}` };
  if (path.startsWith(".github/")) return { kind: "github" };
  if (path.startsWith("ios/")) return { kind: "ios" };
  if (PACKAGE_PREFIXES.some((prefix) => path.startsWith(prefix)))
    return { kind: "turbo" };
  return { kind: "full", reason: `unknown surface: ${path}` };
}

// `affectedPackages` is a lazy callback returning the package names Turbo
// reports as affected; it is only invoked when package files changed, and any
// throw it produces degrades to a full run.
export function classifyChanges({ headRef, files, affectedPackages }) {
  if (RELEASE_BRANCH.test(headRef ?? ""))
    return fullDecision(`release branch: ${headRef}`);
  if (!Array.isArray(files) || files.length === 0)
    return fullDecision("empty or unreadable diff");

  const kinds = new Set();
  for (const file of files) {
    const classified = classifyPath(file);
    if (classified.kind === "full") return fullDecision(classified.reason);
    kinds.add(classified.kind);
  }

  const units = emptyUnits();
  if (kinds.has("github")) units.automation = true;
  if (kinds.has("ios")) {
    units.automation = true;
    units.ios = true;
  }

  if (kinds.has("turbo")) {
    let affected;
    try {
      affected = affectedPackages();
    } catch (error) {
      return fullDecision(`turbo graph unavailable: ${error.message}`);
    }
    if (!Array.isArray(affected))
      return fullDecision("turbo graph returned no package list");
    const packageNames = affected.filter((name) => name !== "//");
    if (packageNames.length === 0)
      return fullDecision(
        "package files changed but turbo reports none affected",
      );
    for (const name of packageNames) {
      if (name === "pulpe-shared")
        return fullDecision("turbo graph marks shared affected");
      const mapped = PACKAGE_UNITS.get(name);
      if (!mapped) return fullDecision(`unknown package: ${name}`);
      for (const unit of mapped) units[unit] = true;
    }
  }

  // The workspace quality gate is a strict superset of the automation unit.
  if (units.workspace) units.automation = false;

  const active = UNITS.filter((unit) => units[unit]);
  if (active.length === 0)
    return fullDecision("no unit selected for the change set");
  return {
    decision: "routed",
    scope: "affected",
    reason: `units: ${active.join(", ")}`,
    units,
  };
}

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

export function resolveChangedFiles({ base, head, exec = run }) {
  for (const sha of [base, head]) {
    if (!/^[0-9a-f]{40}$/.test(sha ?? ""))
      throw new Error(`invalid commit sha: ${sha}`);
  }
  // Validating the merge base proves the history is deep enough; the
  // three-dot diff then lists exactly the PR's own changes. --no-renames
  // keeps both sides of a rename so each surface classifies itself.
  exec("git", ["merge-base", base, head]);
  return exec("git", [
    "diff",
    "--name-only",
    "--no-renames",
    `${base}...${head}`,
  ])
    .split("\n")
    .filter(Boolean);
}

export function queryAffectedPackages({ base, head, exec = run }) {
  const output = exec("pnpm", [
    "exec",
    "turbo",
    "query",
    `{ affectedPackages(base: "${base}", head: "${head}") { items { name } } }`,
  ]);
  const items = JSON.parse(output)?.data?.affectedPackages?.items;
  if (!Array.isArray(items)) throw new Error("unexpected turbo query shape");
  return items.map((item) => item.name);
}

const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined)
      throw new Error(`invalid argument: ${key}`);
    options[key.slice(2)] = value;
  }
  return options;
};

const isMain = process.argv[1]?.endsWith("classify-ci-changes.mjs");
if (isMain) {
  let decision;
  try {
    const options = parseArgs(process.argv.slice(2));
    const { base, head } = options;
    const files = resolveChangedFiles({ base, head });
    decision = classifyChanges({
      headRef: options["head-ref"],
      files,
      affectedPackages: () => queryAffectedPackages({ base, head }),
    });
  } catch (error) {
    decision = fullDecision(`classification failed: ${error.message}`);
  }
  process.stdout.write(`${JSON.stringify(decision)}\n`);
}
