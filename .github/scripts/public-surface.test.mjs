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
  assert.doesNotMatch(
    support,
    /tes données ne sortent jamais de ton compte/i,
  );
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

  assert.match(workflow, /pull-requests:\s*write/);
  assert.match(guide, /pull-requests:\s*write/);
  assert.match(workflow, /NODE_VERSION:\s*["']24["']/);
  assert.match(guide, /NODE_VERSION:\s*["']24["']/);
});

test("tracked project files exclude local archives and obsolete fixtures", () => {
  const ignore = read(".gitignore");
  const seed = read("backend-nest/supabase/seed.sql");

  assert.equal(git("ls-files", "--", "aidd_docs/tasks"), "");
  assert.equal(git("ls-files", "--", "backend-nest/schema.sql"), "");
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
