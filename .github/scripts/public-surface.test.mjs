import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.ok([0, 1].includes(result.status), result.stderr);
  return result.stdout;
};

test("a clone does not pre-authorize repository automation", () => {
  const settings = JSON.parse(read(".claude/settings.json"));
  assert.equal(settings.permissions, undefined);
  assert.equal(settings.enableAllProjectMcpServers, undefined);
  assert.equal(settings.hooks, undefined);
  assert.equal(
    existsSync(
      new URL(
        "../../.claude/hooks/sync-env-on-worktree-start.sh",
        import.meta.url,
      ),
    ),
    false,
  );

  for (const agent of [
    ".claude/agents/backend-developer.md",
    ".claude/agents/frontend-developer.md",
    ".claude/agents/ios-developer.md",
  ]) {
    assert.doesNotMatch(read(agent), /permissionMode:\s*bypassPermissions/);
  }

  assert.match(read(".gitignore"), /^\.claude\/settings\.local\.json$/m);
});

test("public security and deletion claims describe the implemented model", () => {
  const claims = [
    "docs/BUSINESS_WORKFLOW.md",
    "memory-bank/productContext.md",
    "ios/Pulpe/Core/Encryption/ClientKeyManager.swift",
    "landing/app/support/page.tsx",
    "landing/data/releases.json",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(
    claims,
    /chiffr[^\s]*(?:\s+\w+){0,3}\s+de bout en bout|zero[- ]knowledge|end-to-end encryption/i,
  );
  assert.match(claims, /AES-256-GCM/);
  assert.match(claims, /déchiffr[^\s]*\s+(?:côté\s+)?serveur/i);

  const support = read("landing/app/support/page.tsx");
  assert.doesNotMatch(support, /rien n['’]est conservé|zéro trace/i);
  assert.match(support, /systèmes actifs/i);
  assert.match(support, /sauvegardes/i);

  const consent = read("docs/CONSENT.md");
  assert.doesNotMatch(
    consent,
    /intérêt légitime|jurisprudence|valeur probatoire|problème produit n°1/i,
  );
});

test("tracked project files exclude local archives and obsolete fixtures", () => {
  const ignore = read(".gitignore");
  const seed = read("backend-nest/supabase/seed.sql");

  assert.equal(git("ls-files", "--", "aidd_docs/tasks"), "");
  assert.equal(
    existsSync(new URL("../../backend-nest/schema.sql", import.meta.url)),
    false,
  );
  assert.match(ignore, /^backend-nest\/schema\.sql$/m);
  assert.doesNotMatch(
    seed,
    /maxime\.desogus@gmail\.com|Maxime Desogus|12345678/,
  );
  assert.match(seed, /demo@pulpe\.test/);

  const personalHome = ["/Users", "maximedesogus"].join("/");
  assert.equal(git("grep", "-I", "-n", personalHome, "--", "."), "");
  const privateNames = [
    ["Syl", "vie"].join(""),
    ["Ju", "lie"].join(""),
    ["Ma", "man"].join(""),
    "Coll[eè]gue",
    "Isma[eë]l",
  ].join("|");
  assert.equal(
    git(
      "grep",
      "-I",
      "-i",
      "-n",
      "-E",
      privateNames,
      "--",
      ".",
      ":(exclude)landing/**",
    ),
    "",
  );

  const internalGuidance = [
    ".claude/skills/feature-intelligence/SKILL.md",
    ".claude/skills/product-designer/SKILL.md",
    ".claude/skills/product-owner/SKILL.md",
    "memory-bank/techContext.md",
  ]
    .map(read)
    .join("\n");
  assert.doesNotMatch(
    internalGuidance,
    /3 production users|QI dans la moyenne|Maxime de Sogus|127 pts|App Store submission pending/i,
  );
});
