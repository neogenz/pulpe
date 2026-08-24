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

test("a clone does not pre-authorize sensitive repository automation", () => {
  const settings = JSON.parse(read(".claude/settings.json"));
  assert.equal(settings.permissions, undefined);
  assert.equal(settings.enableAllProjectMcpServers, undefined);
  assert.doesNotMatch(
    JSON.stringify(settings.hooks?.SessionStart ?? []),
    /(?:sync-env|\.env\b|CONDUCTOR_ROOT_PATH|PULPE_MAIN_WORKSPACE)/i,
  );
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
  // La copie de la landing vit dans les catalogues depuis qu'elle est traduite.
  // Les quatre langues entrent dans le corpus : une promesse excessive glissée
  // dans la version allemande ne se verrait nulle part ailleurs.
  const claims = [
    "docs/BUSINESS_WORKFLOW.md",
    "docs/ENCRYPTION.md",
    "ios/Pulpe/Core/Encryption/ClientKeyManager.swift",
    "landing/content/dictionaries/fr.ts",
    "landing/content/dictionaries/en.ts",
    "landing/content/dictionaries/de.ts",
    "landing/content/dictionaries/it.ts",
    "landing/data/releases.json",
  ]
    .map(read)
    .join("\n");

  assert.doesNotMatch(
    claims,
    /chiffr[^\s]*(?:\s+\w+){0,3}\s+de bout en bout|zero[- ]knowledge|end.to.end encryption|Ende-zu-Ende|crittografi[^\s]*(?:\s+\w+){0,3}\s+end.to.end|da un capo all'altro/i,
  );
  assert.match(claims, /AES-256-GCM/);
  assert.match(claims, /déchiffr[^\s]*\s+(?:côté\s+)?serveur/i);

  const support = read("landing/content/dictionaries/fr.ts");
  assert.doesNotMatch(support, /rien n['’]est conservé|zéro trace/i);
  assert.match(support, /systèmes actifs/i);
  assert.match(support, /sauvegardes/i);
  assert.doesNotMatch(support, /tes données ne sortent jamais de ton compte/i);
  assert.match(
    support,
    /tes montants et libellés financiers ne sont ni transmis\s+à des fins publicitaires ni revendus/i,
  );

  const consent = read("docs/CONSENT.md");
  assert.match(consent, /Paramètres → Données de diagnostic/);
  assert.match(consent, /Préférences → Données et confidentialité/);
  assert.doesNotMatch(
    consent,
    /intérêt légitime|jurisprudence|valeur probatoire|problème produit n°1/i,
  );
});

test("public CI guide mirrors the enforced workflow contracts", () => {
  const workflow = read(".github/workflows/ci.yml");
  const guide = read("docs/CI.md");

  assert.doesNotMatch(workflow, /pull-requests:\s*write/);
  assert.match(guide, /`contents: read`/);
  assert.match(workflow, /NODE_VERSION:\s*["']24["']/);
  assert.match(guide, /NODE_VERSION:\s*["']24["']/);
});

test("active tracked context does not reference the retired memory bank", () => {
  const retiredContextPattern = [
    "memory-bank/",
    "DA\\.md",
    "productContext\\.md",
    "systemPatterns\\.md",
    "techContext\\.md",
    "projectbrief\\.md",
    "INFRASTRUCTURE\\.md",
    "roadmap\\.md",
    "RG-010",
  ].join("|");

  assert.equal(
    git(
      "grep",
      "-n",
      "-I",
      "-E",
      retiredContextPattern,
      "--",
      ".",
      ":(exclude).github/scripts/public-surface.test.mjs",
      ":(exclude)aidd_docs/tasks/2026_07/2026_07_27_currency_gate_retirement/review.md",
      ":(exclude)aidd_docs/tasks/2026_07/2026_07_28_durcir-preview-open-source/phase-7.md",
    ),
    "",
  );
});

test("tracked AIDD history excludes workstation paths, personal emails, and credentials", () => {
  const taskPaths = git("ls-files", "-z", "--", "aidd_docs/tasks")
    .split("\0")
    .filter(Boolean);
  for (const path of taskPaths) {
    assert.equal(
      readFileSync(new URL(`../../${path}`, import.meta.url)).includes(0),
      false,
      `${path} contains a NUL byte`,
    );
  }

  assert.equal(
    git(
      "grep",
      "-n",
      "-I",
      "-E",
      String.raw`/(Users|home)/[A-Za-z0-9._-]+/|[A-Za-z0-9._%+-]+@(gmail|icloud|outlook|protonmail|yahoo)\.[A-Za-z]{2,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9_]{20,}|sk_live_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9_-]{12,}`,
      "--",
      "aidd_docs/tasks",
      ".impeccable/critique",
    ),
    "",
  );
});

test("tracked project files preserve AIDD history and skill contracts", () => {
  const ignore = read(".gitignore");
  const seed = read("backend-nest/supabase/seed.sql");

  assert.notEqual(git("ls-files", "--", "aidd_docs/tasks"), "");
  assert.doesNotMatch(ignore, /^aidd_docs\/tasks\/?$/m);
  assert.equal(git("ls-files", "--", "aidd_docs/tasks/**/evidence/**"), "");
  assert.match(ignore, /^aidd_docs\/tasks\/\*\*\/evidence\/$/m);
  assert.equal(git("ls-files", "--", "backend-nest/schema.sql"), "");
  assert.match(ignore, /^backend-nest\/schema\.sql$/m);
  assert.match(seed, /demo@pulpe\.test/);

  const productDesigner = read(".claude/skills/product-designer/SKILL.md");
  assert.match(productDesigner, /Revolut, UBS, PostFinance, Raiffeisen/);
  assert.match(productDesigner, /Lois UX/);

  const productOwner = read(".claude/skills/product-owner/SKILL.md");
  assert.match(productOwner, /Calculer la vélocité d'un sprint/);
  assert.match(
    productOwner,
    /Additionner uniquement les estimations déjà enregistrées dans Linear/,
  );
  assert.match(
    productOwner,
    /Ne jamais estimer rétroactivement ni modifier une issue "Done"/,
  );

  const storyFormat = read(
    ".claude/skills/product-owner/references/user-story-format.md",
  );
  assert.match(storyFormat, /Template \(copier-coller exact\)/);
  assert.match(storyFormat, /Barème d'estimation \(Story Points\)/);
});

test("the plugin manifest lets Claude Code see every release", () => {
  const manifest = JSON.parse(read("plugins/pulpe/.claude-plugin/plugin.json"));

  // Declaring `version` pins the plugin: Claude Code compares that string and
  // keeps the cached copy until someone bumps it by hand, so every release
  // after it goes unseen. On a git source, omitting the field makes the
  // resolved commit SHA the update signal, which cannot drift.
  assert.equal(
    manifest.version,
    undefined,
    "plugins/pulpe/.claude-plugin/plugin.json must not declare a version",
  );
});
