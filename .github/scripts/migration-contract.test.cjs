const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process"), { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os"), { join } = require("node:path"), test = require("node:test");
const { metadata, validateExpand } = require("./check-migration-contract.cjs"), script = join(__dirname, "check-migration-contract.cjs");
const isolatedEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_") && !key.startsWith("LEFTHOOK")));
const git = (cwd, ...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd, env: isolatedEnv, encoding: "utf8", stdio: "pipe" }).trim();
const run = (cwd) => spawnSync(process.execPath, [script, "base", "HEAD"], { cwd, env: isolatedEnv, encoding: "utf8" });
const writeMigration = (cwd, sql) => {
  const dir = join(cwd, "backend-nest/supabase/migrations"); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "202608200001_change.sql"), sql);
};
function fixture(sql, check, prepare = () => {}) {
  const cwd = mkdtempSync(join(tmpdir(), "pulpe-migration-"));
  try {
    git(cwd, "init", "-q"); git(cwd, "config", "user.email", "ci@pulpe.app"); git(cwd, "config", "user.name", "CI");
    writeFileSync(join(cwd, "README.md"), "base\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "base");
    git(cwd, "tag", "v1.0.0"); git(cwd, "branch", "base"); prepare(cwd); writeMigration(cwd, sql);
    git(cwd, "add", "."); git(cwd, "commit", "-qm", "candidate"); check(run(cwd), cwd);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
}
const expand = "-- pulpe:migration-phase expand\n";
test("fixtures ignore ambient Git and hook context", () => fixture(`${expand}select 1;\n`, (r) => assert.equal(r.status, 0, r.stderr)));
test("metadata stays in the initial comment header", () => {
  assert.equal(metadata(`${expand}select 1`, "test.sql").phase, "expand");
  for (const sql of ["select 1", "select 1;\n-- pulpe:migration-phase expand", "do $$ -- pulpe:migration-phase expand $$", `${expand}-- pulpe:migration-phase contract\nselect 1`])
    assert.throws(() => metadata(sql, "test.sql"), /phase/i);
});
test("expand accepts additive SQL and inert text", () => {
  const cases = ["alter table budgets add column note text", "alter table budgets add column state text not null default 'new'", "alter table budgets add constraint budgets_amount_positive check (amount >= 0) not valid", "alter table budgets add constraint budgets_owner_present check (owner_id is not null) not valid", "alter table budgets add foreign key (owner_id) references users(id) not valid", "alter table budgets add column note text, add constraint budgets_state_check check (state <> '') not valid", "alter table budgets add constraint budgets_state_check check (state <> '') not valid, add column note text", "create table audit(id uuid); create index audit_id on audit(id); create policy p on audit for select using(true)", "create view active_budgets as select * from budgets", "create or replace function demo() returns text language sql as $body$ select 'DELETE FROM budgets'; -- EXECUTE ignored\n $body$", "select $$CREATE OR REPLACE VIEW hidden AS SELECT 1$$; select 'CREATE OR REPLACE VIEW hidden AS SELECT 1'; -- CREATE OR REPLACE VIEW hidden AS SELECT 1"];
  for (const sql of cases) assert.doesNotThrow(() => validateExpand(`${expand}${sql}`, "test.sql"), sql);
});
test("expand fails closed on destructive or ambiguous SQL", () => {
  const cases = [["drop table budgets", /destructive/i], ["alter table budgets rename to old_budgets", /destructive/i], ["truncate budgets", /destructive/i], ["delete from budgets", /destructive/i], ["alter table budgets set schema archive", /destructive/i], ["alter table budgets disable row level security", /security/i], ["alter table budgets disable trigger all", /security/i], ["revoke select on budgets from authenticated", /security/i], ["alter table budgets alter state set not null", /destructive/i], ["alter table budgets add unsafe text not null, add safe text default 'x'", /NOT NULL.*DEFAULT/i], ["alter table budgets add unsafe text not null, alter safe set default 'x'", /NOT NULL.*DEFAULT/i], ["alter table budgets add column state text not null", /NOT NULL.*DEFAULT/i], ["alter table budgets add column owner_id uuid references users(id)", /inline REFERENCES/i], ["alter table budgets add column amount numeric check (amount >= 0)", /inline CHECK/i], ["alter table budgets add check (not valid)", /CHECK.*NOT VALID/i], ["alter table budgets add constraint budgets_amount_positive check (amount >= 0)", /CHECK.*NOT VALID/i], ["alter table budgets add foreign key (owner_id) references users(id)", /FOREIGN KEY.*NOT VALID/i], ["alter table budgets add column note text, add constraint budgets_state_check check (state <> '')", /CHECK.*NOT VALID/i], ["alter table budgets add unique (owner_id)", /UNIQUE.*contract/i], ["alter table budgets add primary key (id)", /PRIMARY KEY.*contract/i], ["alter table budgets add constraint budgets_period_exclusion exclude using gist (period with &&)", /EXCLUDE.*contract/i], ["alter table budgets add constraint budgets_unknown using index budgets_idx", /unknown.*contract/i], ["create or replace view active_budgets as select * from budgets", /CREATE OR REPLACE VIEW.*contract/i], ["do $$ begin execute 'drop table budgets'; end $$", /DO block/i], ["execute 'drop table budgets'", /EXECUTE/i], ["create or replace function demo() returns void language plpgsql as $$ begin execute 'drop table budgets'; end $$", /EXECUTE/i], ["create procedure demo() language plpgsql as $$ begin perform 1; end $$", /dollar/i], ["create procedure demo() language plpgsql as 'begin delete from budgets; end'", /procedural/i], ["create function demo() returns void language plpgsql as E'begin execute ''drop table budgets''; end'", /procedural/i], ["create function demo() returns void language plpgsql as U&'begin perform 1; end'", /procedural/i], ["select 'oops", /unclosed/i], ["/* oops", /unclosed/i], ["do $$ begin", /unclosed/i]];
  for (const [sql, error] of cases) assert.throws(() => validateExpand(`${expand}${sql}`, "test.sql"), error, sql);
});
test("runtime changes may accompany expand", () => fixture(`${expand}alter table budgets add column note text;\n`, (r) => assert.equal(r.status, 0, r.stderr), (cwd) => writeFileSync(join(cwd, "runtime.ts"), "changed\n")));
test("contract requires an ancestor safe-after", () => fixture("-- pulpe:migration-phase contract\n-- pulpe:safe-after v9.9.9\ndrop table budgets;\n", (r) => assert.match(r.stderr, /safe-after/i)));
test("contract accepts a published ancestor", () => fixture("-- pulpe:migration-phase contract\n-- pulpe:safe-after v1.0.0\ndrop table budgets;\n", (r) => assert.equal(r.status, 0, r.stderr)));
test("contract accepts published content integrated without raw ancestry", () => fixture("-- pulpe:migration-phase contract\n-- pulpe:safe-after v1.0.0\ndrop table budgets;\n", (r) => { assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /1 new file/); }, (cwd) => {
  git(cwd, "switch", "-qc", "production"); writeFileSync(join(cwd, "release.txt"), "released\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "production"); git(cwd, "tag", "-f", "v1.0.0");
  git(cwd, "switch", "base"); writeFileSync(join(cwd, "release.txt"), "released\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "integrate release content"); git(cwd, "switch", "-c", "candidate");
}));
test("contract rejects divergent or conflicting release tags", () => {
  for (const conflict of [false, true]) fixture("-- pulpe:migration-phase contract\n-- pulpe:safe-after v1.0.0\ndrop table budgets;\n", (r) => assert.match(r.stderr, /integrated/i), (cwd) => {
    git(cwd, "switch", "-qc", "production"); writeFileSync(join(cwd, "release.txt"), "production\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "production"); git(cwd, "tag", "-f", "v1.0.0"); git(cwd, "switch", "base");
    if (conflict) { writeFileSync(join(cwd, "release.txt"), "preview\n"); git(cwd, "add", "."); git(cwd, "commit", "-qm", "preview"); } git(cwd, "switch", "-c", "candidate");
  });
});
test("published migrations are immutable", () => fixture(`${expand}create table budgets(id uuid);\n`, (r, cwd) => {
  git(cwd, "branch", "-f", "base", "HEAD"); writeMigration(cwd, `${expand}drop table budgets;\n`); git(cwd, "commit", "-qam", "rewrite"); assert.match(run(cwd).stderr, /immutable/i);
}));
