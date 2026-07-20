---
status: pending
---

# Instruction: Exécuter les contrats What's New avant le commit de release

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.claude/skills/release/
└── SKILL.md ✏️ lancer les tests de contrat ciblés au Step 7
```

## Tasks to do

### `1)` Ajouter le fail-fast local

1. Exécuter au Step 7 la spec de parité backend.
2. Exécuter les specs de données et de comportement du toast frontend.
3. Lancer ces commandes avant `pnpm quality` et donc avant le commit du Step 9.
4. Conserver la CI complète comme seconde barrière après le push.

### `2)` Valider les commandes documentées

1. Exécuter les commandes exactes depuis les répertoires indiqués.
2. Vérifier que chaque commande échoue lorsqu'un de ses contrats est volontairement cassé dans les preuves des phases précédentes.
3. Exécuter `pnpm quality` après restauration.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                             |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Les contrats backend et frontend modifiés par les Steps 5b-bis et 5c sont exécutés avant tout commit distant   |
| 2    | Les commandes documentées passent sur les données restaurées et `pnpm quality` reste vert                       |
