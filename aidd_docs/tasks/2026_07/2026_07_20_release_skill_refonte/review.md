# Review: Refonte du skill release

- **Verdict**: approve
- **Diff**: `f02e17e1ee760de014a50c35818aeb3e3810da43...b2b4ecf0f93b4a40abf344e4fdfb3e6ed7c5180e`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_20
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Renommer `update-changelog` → `release`

- [x] Le renommage Git, le symlink `../../.claude/skills/release` et les exceptions `.gitignore` conservent les deux surfaces suivies — `.agents/skills/release`, `.gitignore:112`
- [x] Le skill déclare `release`, ses chemins internes ciblent le nouveau répertoire et le validateur sans arguments échoue avec son usage — `.claude/skills/release/SKILL.md:2`, `.claude/skills/release/SKILL.md:398`
- [x] Aucun fichier suivi hors archives AIDD ne référence encore `update-changelog`, et les tests de domaine backend passent — `git grep`, `bun test backend-nest/src/modules/whats-new/domain` => 16 pass

### Phase 2 — Sécuriser l'ordre de publication et le SHA promu

- [x] Le preflight distingue les webhooks externes des trois jobs GitHub gardés et résout `main-protection` par nom — `.claude/skills/release/SKILL.md:66`, `.claude/skills/release/SKILL.md:500`
- [x] Seuls `preview` et `main` synchronisés sont acceptés ; worktree sale, autre branche, identité de publication existante ou bypass absent arrêtent le flux — `.claude/skills/release/SKILL.md:45`, `.claude/skills/release/SKILL.md:139`
- [x] Le SHA figé est poussé sur `preview`, sa CI exacte est requise, puis dérive, annulation, échec et perte d'ascendance bloquent la promotion — `.claude/skills/release/SKILL.md:459`, `.claude/skills/release/SKILL.md:473`, `.claude/skills/release/SKILL.md:481`
- [x] Tag, GitHub Release et gate web attendent CI `main`, Vercel, Railway et health checks associés au SHA exact — `.claude/skills/release/SKILL.md:500`, `.claude/skills/release/SKILL.md:508`, `.claude/skills/release/SKILL.md:536`
- [x] Le gate iOS attend la disponibilité publique App Store — `.claude/skills/release/SKILL.md:537`
- [x] L'en-tête, le Step 9 et les références JS/TS et iOS décrivent le même ordre de mutation — `.claude/skills/release/SKILL.md:14`, `.claude/skills/release/SKILL.md:452`, `.claude/skills/release/references/jsts-release.md:69`, `.claude/skills/release/references/ios-release.md:76`
- [x] La réédition d'une release publiée est séparée du chemin normal et exige un diff public puis une approbation explicite — `.claude/skills/release/SKILL.md:547`

### Phase 3 — Ajouter l'invariant anti-toast-périmé

- [x] `0.37.1` est une exception silencieuse unique et motivée tandis que le toast reste à `0.37.0` — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts:10`
- [x] Le test impose une correspondance exacte, unique et motivée pour toute version produit — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.spec.ts:12`
- [x] Une version ne peut pas être simultanément le toast et une release silencieuse ; `--skip-whats-new` conserve explicitement l'enregistrement silencieux du Step 5c — `.claude/skills/release/SKILL.md:35`, `.claude/skills/release/SKILL.md:313`
- [x] Les tests du toast couvrent égalité et divergence avec un mock indépendant dans sa factory — `frontend/projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts:9`, `frontend/projects/webapp/src/app/layout/whats-new/whats-new-toast.spec.ts:70`
- [x] La commande ciblée n'exécute que les deux fichiers Whats New et passe après restauration des deux mutations de preuve — `pnpm --dir frontend test projects/webapp/src/app/layout/whats-new` => 11 pass

### Phase 4 — Aligner Changesets et la documentation de déploiement

- [x] `baseBranch` vaut `preview`, branche GitHub par défaut confirmée ; les statuts implicite et `--since preview` échouent avec le même diagnostic attendu d'absence de changeset — `.changeset/config.json:10`
- [x] Le guide accepte les deux départs ; son TLDR délègue toute la validation et la promotion à `/release`, tandis que la section détaillée ne promeut que le SHA exact après CI `preview` — `docs/DEPLOYMENT.md:5`, `docs/DEPLOYMENT.md:311`
- [x] Le guide distingue webhooks externes et trois jobs GitHub gardés, puis place les gates après disponibilité de leur surface — `docs/DEPLOYMENT.md:331`, `docs/DEPLOYMENT.md:340`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (18/18) |
| Files checked | Plan et 4 phases, diff complet, skill `release`, références JS/TS et iOS, validateur iOS, symlinks et `.gitignore`, configuration Changesets, guide de déploiement et versioning, données/tests frontend Whats New, données/tests backend Whats New, mémoire infrastructure |
| Unchecked | none |
| Unplanned | none |
