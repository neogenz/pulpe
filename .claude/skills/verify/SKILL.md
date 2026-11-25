---
name: verify
description: Proves that a Pulpe change holds before a commit, a pull request or a release, by running the checks its diff calls for, running the changed app itself, and reporting the evidence with what stays unproven. Use when the user wants to verify, check or validate a change, or before opening a PR. Not for writing new tests or for the release workflow itself.
argument-hint: commit | pr | release
---

# Verify

The verdict is « vérifié » only when every check the diff calls for passed on the current head and the change was seen working in the running app. Anything less is « non vérifié », with the gaps named.

## Rules

- Back every pass with its command, the head it ran on and its decisive output line.
- A result obtained before the last change to code, dependencies, schema or a sync with `main` proves nothing: rerun it.
- Never turn a check green with a sleep, a retry, a skip, a looser assertion or `--no-verify`. Fix the root cause, or report the check as failing.
- A failure the change did not cause is reported apart, not fixed here.
- Third failed round on the same check: stop and hand it to Maxime with its decisive line.
- Never commit, push, merge or post from this skill.
- Report to Maxime in French; the skill files stay in English.

## 1. Select

1. **Level.** `commit` by default, `pr` or `release`; the base is `origin/main`.
2. **Diff.** `git diff --name-only origin/main...HEAD` plus `git status --porcelain`.
3. **Match.** Take every row of [triggers.md](references/triggers.md) that a changed path or hunk matches, plus the row of the level.
4. **Edited checks.** List every changed `*.spec.ts`, `*.test.*`, `frontend/e2e/**`, `android/maestro/**`, `ios/Pulpe*Tests/**`, `.github/scripts/*.test.*`: the change must not quietly loosen its own gate.

## 2. Run

1. **Fast first.** Type-check, lint and unit tests of the touched packages, then builds, then integration and E2E, then the running app. One command per check, long ones in the background with their output in the scratchpad.
2. **Run the change.** Unit tests can pass while the feature is broken. Walk the changed journey in the running app, on each platform the diff touches:
   - Web: the `drive-local-app` skill, headless, French copy.
   - iOS: the simulator, or the `PulpeUITests` harness that `aidd_docs/memory/testing.md` names for backend-free visual QA.
   - Android: the emulator, `pnpm dev:android` (env in `android/README.md`).
   - Landing: `cd landing && pnpm dev`, then the changed page in the browser.
   - Backend only: the endpoint against the local Supabase, or its integration spec.
   - Name what was seen: screen, amount, text. A screenshot path alone is not evidence.
3. **Failure.** Read the decisive line, fix the cause, rerun that check alone, then everything whose result predates the fix.

## 3. Audit

What a green check cannot prove:

1. **Mutation.** For each new business rule (a formula, a guard, a branch the product depends on), neutralise it once, run its test, restore it. A test that still passes proves nothing: finding. Check `git status --porcelain` reads as before.
2. **Edited checks.** For each edited check, say what it proved before and after. A dropped case, a looser assertion or a wait without a named cause is a finding.
3. **Written rules.** The `.claude/rules/` files whose globs match the diff, and `aidd_docs/memory/coding-assertions.md`. A written rule beats the code next to it.
4. **Memory.** A touched domain whose `aidd_docs/memory/` file now says something false is a finding.

## 4. Report

1. **Verdict.** « vérifié » or « non vérifié », in the first line.
2. **Evidence.** Each check with its command, its decisive line, and the head it ran on; for `pr`, whether that head was up to date with `origin/main`.
3. **Gaps.** Each check not run and why (no emulator, no local Supabase, iOS left to CI...).
4. **Findings.** Each audit finding with its `file:line`.
5. **Stamp.** For the commit body or the PR description, in French:

```text
Vérifié sur <sha court> (à jour avec main : oui|non) : <contrôle> (<ligne décisive>) ; …
Vu dans l'app : <plateforme> : <parcours et ce qui s'affiche> ; …
Non joué : <contrôle> (<raison>) ; …
Contrôles modifiés : <fichier> (<ce qu'il prouve>) ; …
```

When a row of `triggers.md` fires on a miss it did not catch, or a new incident teaches a check, add or fix the row with its incident. A row that has not fired in months is pruned.
