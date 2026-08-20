import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("./check-release-lineage.mjs", import.meta.url),
);
const git = (repo, ...args) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();

function repo(t) {
  const path = mkdtempSync(join(tmpdir(), "release-lineage-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  git(path, "init", "-q");
  git(path, "config", "user.email", "test@pulpe.app");
  git(path, "config", "user.name", "Pulpe Test");
  return path;
}

function commit(repo, message, files) {
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(repo, path);
    if (content === null) unlinkSync(absolute);
    else {
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    }
  }
  git(repo, "add", "-A");
  git(repo, "commit", "-qm", message);
  return git(repo, "rev-parse", "HEAD");
}

const check = (repo, main, candidate) =>
  spawnSync(process.execPath, [script, main, candidate], { cwd: repo }).status;
const merge = (repo, treeFrom, first, second) =>
  git(
    repo,
    "commit-tree",
    git(repo, "rev-parse", `${treeFrom}^{tree}`),
    "-p",
    first,
    "-p",
    second,
    "-m",
    "release merge",
  );

function firstCandidate(t) {
  const path = repo(t);
  const main = commit(path, "main", { "app.txt": "base\n" });
  const candidate = commit(path, "candidate", { "feature.txt": "release\n" });
  return { path, main, candidate };
}

test("accepts a first release candidate containing main", (t) => {
  const { path, main, candidate } = firstCandidate(t);
  assert.equal(check(path, main, candidate), 0);
});

test("accepts sequential content without the prior merge commit", (t) => {
  const { path, main, candidate: first } = firstCandidate(t);
  const trustedMain = merge(path, first, main, first);
  const candidate = commit(path, "second", { "next.txt": "next\n" });
  assert.notEqual(
    spawnSync("git", ["merge-base", "--is-ancestor", trustedMain, candidate], {
      cwd: path,
    }).status,
    0,
  );
  assert.equal(check(path, trustedMain, candidate), 0);
});

test("rejects a candidate missing a main-only hotfix", (t) => {
  const { path, main, candidate } = firstCandidate(t);
  git(path, "checkout", "-q", main);
  const hotfix = commit(path, "hotfix", { "hotfix.txt": "required\n" });
  assert.notEqual(check(path, hotfix, candidate), 0);
});

test("rejects a conflicting candidate", (t) => {
  const path = repo(t);
  const base = commit(path, "main", { "app.txt": "base\n" });
  const candidate = commit(path, "preview", { "app.txt": "preview\n" });
  git(path, "checkout", "-q", base);
  const main = commit(path, "main edit", { "app.txt": "main\n" });
  assert.notEqual(check(path, main, candidate), 0);
});

test("rejects a candidate regressed behind the latest release", (t) => {
  const { path, main, candidate: released } = firstCandidate(t);
  const trustedMain = merge(path, released, main, released);
  git(path, "checkout", "-q", main);
  const stale = commit(path, "stale", { "next.txt": "stale\n" });
  assert.notEqual(check(path, trustedMain, stale), 0);
});

test("rejects abbreviated SHAs and non-commit objects", (t) => {
  const { path, main, candidate } = firstCandidate(t);
  const blob = git(path, "rev-parse", `${candidate}:feature.txt`);
  assert.notEqual(check(path, main, candidate.slice(0, 12)), 0);
  assert.notEqual(check(path, main, blob), 0);
});
