---
status: done
---

# Instruction: Bloquer une divergence `preview` / `main` dès le preflight

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── .claude/skills/release/
    └── SKILL.md ✏️ valider les deux ascendances avant toute mutation
```

## Tasks to do

### `1)` Fermer le preflight des deux points d'entrée

1. Après le fetch et la vérification de synchronisation de la branche courante, exiger que `origin/main` et `origin/preview` soient tous deux ancêtres de `HEAD`.
2. Expliquer qu'un départ depuis `preview` refuse un hotfix de `main` non réintégré, tandis qu'un départ depuis `main` refuse une `preview` non promue.
3. Conserver le contrôle d'ascendance post-CI du Step 9 comme défense contre une dérive survenue après le preflight.

### `2)` Prouver l'ordre fail-safe

1. Construire un graphe Git isolé où `main` contient un hotfix absent de `preview` et vérifier que le contrôle de preflight échoue sur `preview`.
2. Vérifier qu'un graphe comparable passe depuis chacun des deux points d'entrée autorisés.
3. Vérifier statiquement que les contrôles d'ascendance apparaissent avant toute modification de version, commit ou push.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Depuis `preview`, un commit présent seulement sur `main` arrête le Step 0 avant toute modification de release ou mutation distante    |
| 1    | Depuis `main`, une avancée de `preview` non intégrée arrête également le Step 0                                                       |
| 1    | Le Step 9 revalide toujours `origin/main` comme ancêtre du SHA après la CI `preview`                                                   |
| 2    | Les graphes synchronisés passent, les deux graphes divergents échouent, et aucun `git push` ne précède les contrôles de preflight     |
