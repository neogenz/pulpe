---
status: in-progress
---

# Instruction: Prouver le staging en observation

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.github/
├── scripts/
│   └── ci-security.test.mjs ✏️
└── workflows/
    ├── ci.yml ✏️
    └── staging-proof.yml ✅
```

## User Journey

```mermaid
flowchart TD
  A["PR vers preview"] --> B["CI complète sur le merge test GitHub"]
  B --> C["Artifact minimal : PR, run, SHA et tree testés"]
  C --> D["Fusion vers preview"]
  D --> E["CI push actuelle et Staging Ready shadow en parallèle"]
  E --> F{"Cinq preuves consécutives concordantes ?"}
  F -->|Non| G["Corriger la preuve sans changer le flux actuel"]
  F -->|Oui| H["Autoriser le cutover de la phase 2"]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Activer la preuve en shadow sans la rendre requise => CI actuelle inchangee: 5: system
  section Happy path
    Fusionner une PR a jour => arbre teste egal arbre fusionne et deployements au bon SHA: 5: system
    Verifier cinq fusions dont une canary release => concordance documentee avant cutover: 5: system
  section Edge case - drift
    Modifier la base ou servir un autre SHA => Staging Ready shadow echoue sans bloquer la CI actuelle: 1: system
  section Edge case - contribution publique
    Executer le code d un fork => aucun secret ni permission d ecriture accessible: 1: system
```

## Tasks to do

### `1)` Émettre la preuve du contenu réellement testé

> Ajouter une identité machine-readable au job final existant sans changer sa matrice.

1. Sur les PR vers `preview`, conserver tous les jobs actuels : Angular, backend, SQL, unitaires, E2E, quality, actionlint et iOS.
2. Faire produire à `✅ CI Success` un artifact JSON minimal contenant le dépôt, le numéro de PR, le run, le SHA head, le SHA de merge GitHub, la base et le tree Git de `GITHUB_SHA`.
3. Émettre l'artifact seulement après le succès de toute la matrice et lier sa durée de rétention au délai maximal de promotion.
4. Garder `pull_request`, jamais `pull_request_target`, avec permissions en lecture et actions épinglées.
5. Ne modifier encore aucun déclencheur `push` ni check requis.

### `2)` Vérifier le staging exact en mode shadow

> Observer d'abord la nouvelle preuve à côté de la CI post-merge actuelle.

1. Créer `staging-proof.yml` sur push `preview` et limiter la première version aux commits provenant d'une PR fusionnée.
2. Retrouver le dernier run PR canonique, télécharger sa preuve et comparer le tree du commit fusionné au tree testé ; le SHA peut différer, le contenu non.
3. Attendre les déploiements Vercel frontend/landing et Railway preview rattachés au commit fusionné, exiger leur état prêt/succès et contrôler les endpoints utiles.
4. Pour Railway, exiger que le déploiement de ce SHA soit actif au moment du health check afin de ne pas valider silencieusement une feature arrivée après lui.
5. Publier `✅ Staging Ready (shadow)` sans le rendre requis et conserver la CI `push preview` comme autorité pendant l'observation.
6. Échouer fermé sur preuve absente, run annulé, tree divergent, fournisseur sur un autre SHA ou déplacement du déploiement pendant les contrôles.

### `3)` Décider le cutover sur des résultats observés

> Ne retirer la duplication que si la preuve légère reproduit correctement le verdict utile.

1. Observer cinq fusions consécutives comprenant frontend/backend, iOS si possible et une PR canary structurée comme une release.
2. Exiger zéro faux positif, zéro preuve ambiguë et une concordance entre le SHA/tree annoncé, les déploiements actifs et la CI post-merge actuelle.
3. Mesurer le temps de `Staging Ready` et confirmer que son coût est nettement inférieur à une matrice complète médiane de 36 runner-min.
4. Si les critères passent, renommer le check `✅ Staging Ready` et autoriser les changements de triggers/rulesets de la phase 2 ; sinon conserver la CI actuelle et corriger ou abandonner la preuve.
5. Étendre `ci-security.test.mjs` pour verrouiller les permissions, l'absence de secrets PR et la validation d'identité, sans encore interdire la CI `push`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Une PR verte produit une seule preuve liant sans ambiguïté le run et le tree Git réellement testé ; une PR non verte n'en produit pas. |
| 1    | Une contribution de fork ne peut lire aucun secret ni obtenir de permission d'écriture.                                                |
| 2    | `Staging Ready (shadow)` devient vert uniquement quand tree testé, commit fusionné, déploiements exacts et smoke checks concordent.    |
| 2    | Un SHA fournisseur obsolète, un Railway preview déjà remplacé ou une preuve issue d'un autre run donne un verdict rouge.               |
| 3    | Cinq fusions, dont une canary release, concordent avec le flux actuel avant toute suppression de CI.                                   |
| 3    | Un échec de la phase d'observation laisse les triggers et protections actuels inchangés.                                               |
