---
status: pending
---

# Instruction: Valider la version affichée par le toast

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/layout/whats-new/
└── whats-new-releases.spec.ts ✏️ appliquer le contrat SemVer à la release affichée
```

## Tasks to do

### `1)` Fermer le cas de version affichée invalide

1. Ajouter une assertion SemVer sur `LATEST_RELEASE.version`.
2. Conserver les invariants existants de version courante, unicité, raison et exclusion mutuelle.

### `2)` Prouver la régression

1. Remplacer temporairement la version affichée par `banana` et reproduire le passage historique.
2. Vérifier que la nouvelle assertion échoue sur cette valeur.
3. Restaurer la donnée et exécuter les specs Whats New frontend.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | Une version affichée non SemVer échoue même lorsque la version produit courante est explicitement silencieuse |
| 2    | Après restauration, les invariants et le comportement du toast passent ensemble                    |
