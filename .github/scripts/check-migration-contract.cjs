#!/usr/bin/env node
const { execFileSync, spawnSync } = require("node:child_process");

const DIR = "backend-nest/supabase/migrations";
const PHASE = /^pulpe:migration-phase (expand|contract)$/;
const SAFE = /^pulpe:safe-after (v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/;
const blank = (text) => text.replace(/[^\n]/g, " ");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const gitOk = (...args) => spawnSync("git", args, { stdio: "ignore" }).status === 0;

function metadata(sql, path) {
  const comments = [];
  let i = 0;
  while (i < sql.length) {
    const ws = /^\s+/.exec(sql.slice(i));
    if (ws) { i += ws[0].length; continue; }
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i);
      comments.push(sql.slice(i + 2, end < 0 ? sql.length : end).trim());
      i = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2);
      if (end < 0) throw Error(`${path}: unclosed block comment`);
      i = end + 2;
      continue;
    }
    break;
  }
  const phases = comments.map((line) => line.match(PHASE)?.[1]).filter(Boolean);
  const safe = comments.map((line) => line.match(SAFE)?.[1]).filter(Boolean);
  if (phases.length !== 1) throw Error(`${path}: initial comment header must declare exactly one migration phase`);
  if (safe.length > 1) throw Error(`${path}: duplicate safe-after markers`);
  return { phase: phases[0], safeAfter: safe[0] };
}

function lex(sql, path) {
  let clean = "";
  const dollars = [], strings = [];
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i), stop = end < 0 ? sql.length : end;
      clean += blank(sql.slice(i, stop)); i = stop; continue;
    }
    if (sql.startsWith("/*", i)) {
      let end = i + 2, depth = 1;
      while (end < sql.length && depth) {
        if (sql.startsWith("/*", end)) { depth++; end += 2; }
        else if (sql.startsWith("*/", end)) { depth--; end += 2; }
        else end++;
      }
      if (depth) throw Error(`${path}: unclosed block comment`);
      clean += blank(sql.slice(i, end)); i = end; continue;
    }
    const quote = sql[i];
    if (quote === "'" || quote === '"') {
      const start = clean.length;
      let end = i + 1, closed = false;
      const escaped = quote === "'" && /[eE]/.test(sql[i - 1] || "");
      while (end < sql.length) {
        if (escaped && sql[end] === "\\") { end += 2; continue; }
        if (sql[end] === quote && sql[end + 1] === quote) { end += 2; continue; }
        if (sql[end] === quote) { end++; closed = true; break; }
        end++;
      }
      if (!closed) throw Error(`${path}: unclosed ${quote === "'" ? "string" : "identifier"}`);
      if (quote === "'") strings.push(start);
      clean += blank(sql.slice(i, end)); i = end; continue;
    }
    if (quote === "$") {
      const delimiter = /^(?:\$\$|\$[A-Za-z_][A-Za-z0-9_]*\$)/.exec(sql.slice(i))?.[0];
      if (delimiter) {
        const close = sql.indexOf(delimiter, i + delimiter.length);
        if (close < 0) throw Error(`${path}: unclosed dollar quote ${delimiter}`);
        const end = close + delimiter.length;
        dollars.push({ start: clean.length, body: sql.slice(i + delimiter.length, close) }); clean += blank(sql.slice(i, end)); i = end; continue;
      }
    }
    clean += quote; i++;
  }
  return { clean, dollars, strings };
}

function validateExpand(sql, path) {
  const { clean, dollars, strings } = lex(sql, path);
  if (/(?:^|;)\s*DO\b/i.test(clean)) throw Error(`${path}: DO blocks are forbidden in expand`);
  for (const start of strings) {
    const prefix = clean.slice(clean.lastIndexOf(";", start - 1) + 1, start).trim();
    if (/\b(?:FUNCTION|PROCEDURE)\b[\s\S]*\bAS(?:\s+(?:E|U&))?\s*$/i.test(prefix)) throw Error(`${path}: single-quoted procedural bodies are forbidden in expand`);
  }
  for (const { start, body } of dollars) {
    const prefix = clean.slice(clean.lastIndexOf(";", start - 1) + 1, start).trim();
    if (/^create\s+or\s+replace\s+function\b/i.test(prefix)) {
      if (/\bEXECUTE\b/i.test(lex(body, path).clean)) throw Error(`${path}: dynamic EXECUTE is forbidden in expand`);
      continue;
    }
    if (/\b(?:FUNCTION|PROCEDURE)\b/i.test(prefix)) throw Error(`${path}: dollar-quoted procedural bodies require CREATE OR REPLACE FUNCTION`);
  }
  if (/\bEXECUTE\b/i.test(clean)) throw Error(`${path}: dynamic EXECUTE is forbidden in expand`);
  for (const statement of clean.split(";").filter((part) => part.trim())) {
    if (/\b(?:DROP|RENAME|TRUNCATE|REVOKE)\b|\bDELETE\s+FROM\b|\bSET\s+SCHEMA\b|\bDISABLE\s+(?:ROW\s+LEVEL\s+SECURITY|TRIGGER|RULE)\b|\bNO\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\b/i.test(statement) || /\bALTER\s+(?:COLUMN\s+)?\b[\s\S]*?\b(?:TYPE|SET\s+NOT\s+NULL)\b/i.test(statement)) throw Error(`${path}: destructive or security-weakening SQL is forbidden in expand`);
    for (const addition of statement.split(/\bADD\s+(?:COLUMN\s+)?/i).slice(1)) {
      const clause = addition.split(/,\s*(?=(?:ADD|ALTER|DROP|RENAME|VALIDATE|ENABLE|DISABLE|ATTACH|DETACH|OWNER|SET|RESET|INHERIT|NO|OF|NOT|CLUSTER|FORCE|REPLICA)\b)/i)[0];
      if (/\bNOT\s+NULL\b/i.test(clause) && !/\bDEFAULT\b/i.test(clause)) throw Error(`${path}: expand cannot ADD a NOT NULL column without DEFAULT`);
    }
  }
}

function containsContent(candidate, trusted) {
  const merged = spawnSync("git", ["merge-tree", "--write-tree", "--no-messages", candidate, trusted], { encoding: "utf8" });
  return merged.status === 0 && merged.stdout.trim() === git("rev-parse", `${candidate}^{tree}`);
}

function validate(path, sql, baseline) {
  const { phase, safeAfter } = metadata(sql, path);
  if (phase === "expand") return validateExpand(sql, path);
  lex(sql, path);
  if (!safeAfter) throw Error(`${path}: contract migrations require -- pulpe:safe-after vX.Y.Z`);
  const tag = `refs/tags/${safeAfter}^{commit}`;
  if (!gitOk("rev-parse", "--verify", "--quiet", tag) || (!gitOk("merge-base", "--is-ancestor", tag, baseline) && !containsContent(baseline, tag))) throw Error(`${path}: safe-after tag ${safeAfter} must be integrated into the release baseline`);
}

function main() {
  const [base, head] = process.argv.slice(2);
  if (!base || !head) throw Error("usage: check-migration-contract.cjs <base> <head>");
  const baseline = git("merge-base", base, head);
  const changed = git("diff", "--name-status", "--find-renames", baseline, head, "--", `${DIR}/`);
  const files = changed ? changed.split("\n").map((line) => line.split("\t")) : [];
  for (const [status, ...paths] of files) {
    if (status !== "A") throw Error(`${paths.join(" -> ")}: published migrations are immutable (${status})`);
    validate(paths[0], git("show", `${head}:${paths[0]}`), baseline);
  }
  process.stdout.write(`Migration contract valid (${files.length} new file(s)).\n`);
}

module.exports = { metadata, validateExpand };
if (require.main === module) {
  try { main(); }
  catch (error) { process.stderr.write(`Migration contract failed: ${error.message}\n`); process.exitCode = 1; }
}
