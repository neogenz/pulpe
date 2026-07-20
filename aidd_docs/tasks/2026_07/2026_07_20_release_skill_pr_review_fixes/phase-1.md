---
status: done
---

# Instruction: Tester la version produit réellement injectée dans le toast

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── frontend/projects/webapp/src/app/layout/whats-new/
    └── whats-new-releases.spec.ts ✏️ utiliser la version du package racine
```

## Tasks to do

### `1)` Aligner l'invariant sur la source de production

1. Remplacer l'import de `frontend/package.json` par celui du `package.json` racine, source de `buildInfo.version`.
2. Nommer la métadonnée comme une version produit et ajuster le commentaire ESLint ainsi que le diagnostic du test.
3. Conserver l'invariant exclusif existant : version annoncée par le toast ou release silencieuse unique et motivée, jamais les deux.

### `2)` Prouver le faux négatif fermé

1. Lancer le dossier de tests Whats New dans l'état courant.
2. Modifier temporairement uniquement la version racine pour simuler un bump produit avec un sous-package en retard ; le nouvel invariant doit échouer.
3. Restaurer la version racine, vérifier le worktree attendu, puis relancer les tests ciblés.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | L'invariant lit exactement la version racine utilisée par `generate-build-info.js`, et non `frontend/package.json`                       |
| 1    | Une version ne peut toujours être simultanément annoncée et inscrite comme silencieuse                                                    |
| 2    | Un bump racine non accompagné d'une décision toast/silencieuse fait échouer le test même si `frontend/package.json` conserve l'ancienne version |
| 2    | Après restauration, seuls les deux fichiers de tests Whats New s'exécutent et les 11 tests passent                                       |
