import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyChanges,
  classifyPath,
  fullDecision,
  queryAffectedPackages,
  resolveChangedFiles,
} from "./classify-ci-changes.mjs";

const neverQueried = () => {
  throw new Error("turbo must not be queried for this change set");
};

const activeUnits = (decision) =>
  Object.entries(decision.units)
    .filter(([, active]) => active)
    .map(([unit]) => unit)
    .sort();

test("a full decision activates every unit and names its reason", () => {
  const decision = fullDecision("because");
  assert.equal(decision.decision, "full");
  assert.equal(decision.scope, "full");
  assert.equal(decision.reason, "because");
  assert.deepEqual(activeUnits(decision), [
    "automation",
    "backend_db",
    "e2e",
    "ios",
    "workspace",
  ]);
});

test("path classes cover automation, iOS, packages, and fail closed elsewhere", () => {
  assert.equal(
    classifyPath(".github/workflows/staging-proof.yml").kind,
    "github",
  );
  assert.equal(
    classifyPath(".github/scripts/start-supabase.sh").kind,
    "github",
  );
  assert.equal(
    classifyPath("ios/Pulpe/Features/Home/HomeView.swift").kind,
    "ios",
  );
  for (const packagePath of [
    "frontend/projects/webapp/src/app/app.ts",
    "backend-nest/src/main.ts",
    "landing/app/page.tsx",
    "android/src/app/index.tsx",
  ]) {
    assert.equal(classifyPath(packagePath).kind, "turbo", packagePath);
  }
  for (const fullPath of [
    ".github/workflows/ci.yml",
    ".github/scripts/classify-ci-changes.mjs",
    ".github/scripts/classify-ci-changes.test.mjs",
    ".github/scripts/ci-security.test.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "turbo.json",
    ".changeset/config.json",
    "android/app.json",
    "ios/Pulpe/Domain/Formulas/BudgetFormulas.swift",
    "shared/src/calculators/budget.ts",
    "docs/CI.md",
    "CLAUDE.md",
    ".claude/skills/release/SKILL.md",
  ]) {
    assert.equal(classifyPath(fullPath).kind, "full", fullPath);
  }
});

test("release branches force a full run before any path is inspected", () => {
  const decision = classifyChanges({
    headRef: "release/v1.2.3",
    files: [".github/README.md"],
    affectedPackages: neverQueried,
  });
  assert.equal(decision.decision, "full");
  assert.match(decision.reason, /release branch/);
});

test("an empty or unreadable diff forces a full run", () => {
  for (const files of [[], undefined]) {
    const decision = classifyChanges({
      headRef: "feat/x",
      files,
      affectedPackages: neverQueried,
    });
    assert.equal(decision.decision, "full");
  }
});

test("GitHub-only changes run automation without touching the turbo graph", () => {
  const decision = classifyChanges({
    headRef: "feat/workflows",
    files: [
      ".github/workflows/staging-proof.yml",
      ".github/scripts/resolve-release-state.mjs",
    ],
    affectedPackages: neverQueried,
  });
  assert.equal(decision.decision, "routed");
  assert.deepEqual(activeUnits(decision), ["automation"]);
});

test("iOS-only changes add the iOS unit to automation", () => {
  const decision = classifyChanges({
    headRef: "feat/ios",
    files: ["ios/Pulpe/Features/Home/HomeView.swift", "ios/project.yml"],
    affectedPackages: neverQueried,
  });
  assert.deepEqual(activeUnits(decision), ["automation", "ios"]);
});

test("package changes route through the turbo graph", () => {
  const cases = [
    [["pulpe-frontend"], ["e2e", "workspace"]],
    [["backend-nest"], ["backend_db", "workspace"]],
    [["pulpe-landing"], ["workspace"]],
    [["pulpe-android"], ["workspace"]],
    [
      ["pulpe-frontend", "backend-nest"],
      ["backend_db", "e2e", "workspace"],
    ],
  ];
  for (const [affected, expected] of cases) {
    const decision = classifyChanges({
      headRef: "feat/x",
      files: ["frontend/projects/webapp/src/app/app.ts"],
      affectedPackages: () => ["//", ...affected],
    });
    assert.equal(decision.decision, "routed", decision.reason);
    assert.equal(decision.scope, "affected");
    assert.deepEqual(activeUnits(decision), expected);
  }
});

test("a workspace run absorbs the automation unit", () => {
  const decision = classifyChanges({
    headRef: "feat/mixed",
    files: [".github/workflows/staging-proof.yml", "landing/app/page.tsx"],
    affectedPackages: () => ["pulpe-landing"],
  });
  assert.deepEqual(activeUnits(decision), ["workspace"]);
});

test("graph uncertainty degrades to a full run with its reason", () => {
  const base = {
    headRef: "feat/x",
    files: ["backend-nest/src/main.ts"],
  };
  const failures = [
    [{ ...base, affectedPackages: neverQueried }, /turbo graph unavailable/],
    [{ ...base, affectedPackages: () => "oops" }, /no package list/],
    [{ ...base, affectedPackages: () => ["//"] }, /none affected/],
    [
      { ...base, affectedPackages: () => ["mystery-package"] },
      /unknown package/,
    ],
    [{ ...base, affectedPackages: () => ["pulpe-shared"] }, /shared affected/],
  ];
  for (const [input, reason] of failures) {
    const decision = classifyChanges(input);
    assert.equal(decision.decision, "full", decision.reason);
    assert.match(decision.reason, reason);
  }
});

test("any full-class file overrides every routed class in the same PR", () => {
  const decision = classifyChanges({
    headRef: "feat/x",
    files: ["frontend/projects/webapp/src/app/app.ts", "docs/CI.md"],
    affectedPackages: neverQueried,
  });
  assert.equal(decision.decision, "full");
  assert.match(decision.reason, /unknown surface: docs\/CI\.md/);
});

test("changed files come from a validated three-dot diff without renames", () => {
  const calls = [];
  const exec = (command, args) => {
    calls.push([command, ...args]);
    return command === "git" && args[0] === "diff" ? "a.ts\n\nb.ts\n" : "sha\n";
  };
  const base = "a".repeat(40);
  const head = "b".repeat(40);
  const files = resolveChangedFiles({ base, head, exec });
  assert.deepEqual(files, ["a.ts", "b.ts"]);
  assert.deepEqual(calls[0], ["git", "merge-base", base, head]);
  assert.deepEqual(calls[1], [
    "git",
    "diff",
    "--name-only",
    "--no-renames",
    `${base}...${head}`,
  ]);

  assert.throws(
    () => resolveChangedFiles({ base: "HEAD", head, exec }),
    /invalid commit sha/,
  );
  assert.throws(
    () => resolveChangedFiles({ base, head: undefined, exec }),
    /invalid commit sha/,
  );
});

test("turbo affected packages parse strictly or throw", () => {
  const exec = () =>
    JSON.stringify({
      data: {
        affectedPackages: {
          items: [{ name: "//" }, { name: "pulpe-frontend" }],
        },
      },
    });
  assert.deepEqual(queryAffectedPackages({ base: "b", head: "h", exec }), [
    "//",
    "pulpe-frontend",
  ]);
  assert.throws(
    () => queryAffectedPackages({ base: "b", head: "h", exec: () => "{}" }),
    /unexpected turbo query shape/,
  );
});
