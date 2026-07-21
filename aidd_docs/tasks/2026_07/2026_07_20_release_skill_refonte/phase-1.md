---
status: done
---

# Instruction: Renommer `update-changelog` → `release`

> Le skill couvre toute la procédure de release. Son nom doit décrire cette responsabilité, pas une seule de ses étapes.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .claude/skills/update-changelog/ → .claude/skills/release/     ✏️ git mv
├── .agents/skills/update-changelog → .agents/skills/release        ✏️ symlink partagé Claude Code / Codex
├── .gitignore                                                      ✏️ commentaire et négations d'ignore
├── .claude/skills/release/
│   ├── SKILL.md                                                    ✏️ nom, description, titre et chemins du validateur
│   └── agents/openai.yaml                                          ✏️ `$update-changelog` → `$release`
├── docs/VERSIONING.md                                              ✏️ invocation du skill
├── memory-bank/INFRASTRUCTURE.md                                   ✏️ invocation réelle, pas un script pnpm inexistant
└── backend-nest/src/modules/whats-new/domain/
    ├── releases-data.parity.spec.ts                                ✏️ message d'échec
    └── releases-data.ts                                            ✏️ commentaire d'en-tête
```

## Tasks to do

### `1)` Déplacer le répertoire et le symlink

1. `git mv .claude/skills/update-changelog .claude/skills/release`.
2. Déplacer le symlink obsolète avec `trash .agents/skills/update-changelog`, puis créer `.agents/skills/release → ../../.claude/skills/release`.
3. Dans `.gitignore`, remplacer le commentaire et les deux négations d'ignore `update-changelog` par `release`.
4. Vérifier la cible avec `readlink .agents/skills/release`.
5. Vérifier que ni le skill ni le symlink ne sont ignorés avec `git check-ignore --no-index`; le code de sortie attendu est `1`.

### `2)` Mettre à jour les références internes au skill

1. Dans `SKILL.md`, définir `name: release`, ajuster les déclencheurs autour de « release » / « préparer une release », et renommer le titre H1 en `# Release`.
2. Remplacer tous les chemins du validateur par `.claude/skills/release/scripts/validate-ios-release.ts`.
3. Dans `agents/openai.yaml`, remplacer `$update-changelog` par `$release`.
4. Depuis la racine, lancer le validateur sans arguments : il doit afficher `Usage` et sortir avec le code `1`, puisque l'absence d'arguments est volontairement invalide.

### `3)` Mettre à jour les références externes

1. Dans `docs/VERSIONING.md`, remplacer `/update-changelog` par `/release`.
2. Dans `memory-bank/INFRASTRUCTURE.md`, remplacer le faux script `pnpm update-changelog` par l'invocation réelle du skill.
3. Dans `releases-data.parity.spec.ts`, faire pointer le message d'échec vers `/release`.
4. Dans `releases-data.ts`, mettre à jour le commentaire d'en-tête.
5. Rechercher les références suivies avec `git grep -n "update-changelog"` ; seules les archives de plan AIDD peuvent conserver l'ancien nom.
6. Exécuter `bun test backend-nest/src/modules/whats-new/domain` pour couvrir les deux fichiers de domaine modifiés sans inclure les tests HTTP indépendants de ce renommage.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le répertoire est conservé comme renommage Git ; le nouveau symlink cible `../../.claude/skills/release` ; ni le skill ni le symlink ne sont ignorés           |
| 2    | Le skill se déclare et s'invoque sous le nom `release` ; tous ses chemins internes résolvent ; l'appel invalide du validateur échoue uniquement avec son usage |
| 3    | Aucun fichier suivi hors archives AIDD ne référence `update-changelog` ; les tests de domaine backend Whats New restent verts                                  |
