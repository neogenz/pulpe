---
status: pending
---

# Instruction: Durcir les invariants de projection iOS

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/modules/whats-new/domain/
├── releases-data.parity.spec.ts ✏️ valider le JSON landing et refuser les notes dupliquées
└── releases-data.ts ✏️ documenter le registre des releases iOS silencieuses
```

## Tasks to do

### `1)` Refuser les doublons de projection

1. Prouver qu'une note iOS dupliquée passe le contrat actuel.
2. Étendre l'invariant de sous-ensemble pour refuser toute clé `title + description` répétée.
3. Restaurer les données et vérifier la parité complète.

### `2)` Valider l'entrée landing

1. Traiter `JSON.parse` comme une valeur inconnue.
2. Valider les champs et collections consommés avant la parité, avec un diagnostic localisé.
3. Ne pas ajouter de dépendance ou de schéma applicatif parallèle.

### `3)` Aligner la documentation

1. Remplacer le JSDoc qui décrit une absence implicite par la décision explicite du registre `SILENT_IOS_RELEASES`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Une note projetée deux fois échoue avant de pouvoir être affichée deux fois dans le dialogue iOS            |
| 2    | Un JSON landing structurellement invalide échoue avec le chemin du champ concerné, avant les boucles métier |
| 3    | La documentation distingue clairement projection et release iOS silencieuse                                |
