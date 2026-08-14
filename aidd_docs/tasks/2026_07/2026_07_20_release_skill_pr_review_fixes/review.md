# Review: Correctifs de review du skill release

- **Verdict**: approve
- **Diff**: `0b8ea460fec313935f325a7301c5f6f4c4aa1a64...610b8bc4d2766309cbaa698d5c5d7e8e865d032f`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_20
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Tester la version produit réellement injectée dans le toast

- [x] L'invariant lit le `package.json` racine utilisé par le générateur de `buildInfo.version` — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts:4`, `frontend/scripts/generate-build-info.js:51`
- [x] Une version ne peut être simultanément annoncée et silencieuse — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts:11`, `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts:39`
- [x] Un bump racine isolé ferme le faux négatif historique — mutation `0.37.1` → `0.37.2` avec `frontend/package.json` inchangé => ancien import `11/11` vert, nouvel import `1 failed / 10 passed` avec `Product version 0.37.2 must have exactly one toast or silent-release entry`; `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts:4`
- [x] Après restauration, seuls les deux fichiers Whats New s'exécutent et les 11 tests passent — `vitest run .../whats-new-releases.spec.ts .../whats-new-toast.spec.ts` => `Test Files 2 passed (2)`, `Tests 11 passed (11)`; `typecheck:spec` => exit 0

### Phase 2 — Bloquer une divergence `preview` / `main` dès le preflight

- [x] Depuis `preview`, un hotfix présent seulement sur `main` bloque le Step 0 — `.claude/skills/release/SKILL.md:61`, `.claude/skills/release/SKILL.md:62`; harness => `preview_missing_main_hotfix=blocked`
- [x] Depuis `main`, une avancée non promue de `preview` bloque le Step 0 — `.claude/skills/release/SKILL.md:61`, `.claude/skills/release/SKILL.md:63`; harness => `main_missing_preview_change=blocked`
- [x] Le Step 9 revalide toujours `origin/main` comme ancêtre du SHA après la CI `preview` — `.claude/skills/release/SKILL.md:483`, `.claude/skills/release/SKILL.md:488`
- [x] Les deux graphes synchronisés passent, les deux graphes divergents bloquent et l'ordre reste fail-safe — harness => `synchronized_preview_start=pass`, `synchronized_main_start=pass`, `preview_missing_main_hotfix=blocked`, `main_missing_preview_change=blocked`; `.claude/skills/release/SKILL.md:62`, `.claude/skills/release/SKILL.md:63`, `.claude/skills/release/SKILL.md:371`, `.claude/skills/release/SKILL.md:464`, `.claude/skills/release/SKILL.md:472`

### Phase 3 — Garder le scénario de divergence indépendant des releases

- [x] Le scénario de divergence ne contient plus de version produit codée en dur — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts:70`
- [x] Le mock reste différent de toute valeur future de `LATEST_RELEASE.version` — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts:71`
- [x] La mutation `LATEST_RELEASE.version = '0.37.1'` reproduit l'échec historique et valide le correctif dérivé — ancien mock => `Test Files 1 failed`, `Tests 1 failed | 7 passed`; mock dérivé => `Test Files 1 passed`, `Tests 8 passed`; `frontend/projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts:71`
- [x] Après restauration, les huit tests du toast et le typecheck des specs passent — `whats-new-toast.spec.ts` => `Test Files 1 passed`, `Tests 8 passed`; `typecheck:spec` => exit 0

### Phase 4 — Identifier précisément chaque dérive de métadonnées

- [x] `iosVersion`, `date`, `platforms` et les notes techniques ont chacun leur garde et leur diagnostic, sans booléen agrégé — `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:56`, `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:63`, `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:72`, `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:79`
- [x] Les plateformes sont clonées, triées localement puis comparées, et toute note technique projetée reste interdite — `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:70`, `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:79`
- [x] Une mutation de date remplace le diagnostic générique par le champ et les deux valeurs en conflit — avant => `projection metadata differs`; après => `date mismatch: projection="2026-07-02", landing="2026-07-01"`; `backend-nest/src/modules/whats-new/domain/releases-data.parity.spec.ts:66`
- [x] Après restauration, la parité, le typecheck backend et la qualité du workspace passent sans donnée persistante modifiée — parity spec `2 pass / 0 fail`; `bun run type-check:full` => exit 0; `pnpm quality` => `10/10`, 34 warnings backend préexistants et 0 erreur; worktree propre

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (16/16) |
| Files checked | Plan et 4 phases, diff complet de 9 fichiers, skill release, générateur `buildInfo`, composant/données/tests Whats New web, projection/données/tests de parité iOS backend/landing, architecture NestJS, règles TypeScript/layout/Vitest, mémoires testing/coding/package/VCS/deployment |
| Unchecked | none |
| Unplanned | none |
