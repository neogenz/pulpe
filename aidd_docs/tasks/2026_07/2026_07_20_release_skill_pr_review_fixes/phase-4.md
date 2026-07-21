---
status: done
---

# Instruction: Identifier précisément chaque dérive de métadonnées

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/modules/whats-new/domain/
└── releases-data.parity.spec.ts ✏️ diagnostiquer le champ de métadonnées fautif
```

## Tasks to do

### `1)` Remplacer le diagnostic agrégé

1. Dans `assertMetadataParity`, vérifier séparément `iosVersion`, `date`, `platforms` et l'absence de notes techniques.
2. Pour les champs scalaires et les plateformes, inclure les valeurs projetée et landing dans le message d'erreur.
3. Conserver la comparaison des plateformes indépendante de leur ordre.
4. Ne modifier ni les données de release, ni le contrat de projection, ni les autres assertions.

### `2)` Prouver le diagnostic

1. Reproduire le message générique historique avec une mutation temporaire de `date`.
2. Après correction, répéter la mutation et vérifier que le message nomme `date` et les deux valeurs en conflit.
3. Vérifier statiquement les diagnostics `iosVersion`, `platforms` et notes techniques.
4. Restaurer les données et exécuter le test de parité complet.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Chaque champ de métadonnées produit son propre diagnostic sans booléen agrégé                                                     |
| 1    | Les plateformes restent comparées comme des ensembles ordonnés localement et les notes techniques restent interdites             |
| 2    | Une mutation de date passe du message générique à un message contenant le champ et les deux valeurs                              |
| 2    | Après restauration, `releases-data.parity.spec.ts` et la qualité du workspace passent, sans modification durable des données     |
