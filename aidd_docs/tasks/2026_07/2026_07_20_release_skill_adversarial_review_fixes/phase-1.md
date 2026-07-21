---
status: done
---

# Instruction: Rendre chaque bloc de publication sûr et autonome

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.claude/skills/release/
└── SKILL.md ✏️ reconstituer et valider les identités avant chaque usage distant
```

## Tasks to do

### `1)` Éliminer les refspecs dépendantes d'une session précédente

1. Déclarer que chaque bloc shell du Step 9 doit être autonome.
2. Recalculer `SHA` au début de chaque bloc qui l'utilise et refuser une valeur vide ou non résolue comme commit.
3. Utiliser les expansions délimitées `${SHA}` dans chaque refspec.
4. Reconstituer également `TAG` et les identifiants de run dans le bloc où ils sont consommés.
5. Conserver la promotion du même commit exact et toutes les validations d'ascendance existantes.

### `2)` Prouver le comportement fail-safe

1. Vérifier statiquement qu'aucun refspec `$SHA:` non délimité ne subsiste.
2. Vérifier avec un harness local qu'une variable absente ne peut produire une commande de suppression de `preview`.
3. Vérifier que les blocs valides ciblent toujours un SHA de commit non vide.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | Aucun push ou dry-run distant ne dépend d'une variable définie uniquement dans un bloc précédent                    |
| 1    | Une valeur `SHA` vide ou invalide bloque avant toute commande `git push`                                             |
| 2    | Le scénario sans variable échoue localement et le scénario valide conserve le refspec `<sha>:refs/heads/<branche>`  |
