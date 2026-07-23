---
status: done
---

# Instruction: Rebaser sur la preview courante

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── ✏️ .gitignore — préserver le symlink versionné sans perdre les règles ajoutées par preview
├── backend-nest/src/
│   ├── ✏️ app.module.ts — conserver les modules preview et WhatsNewModule
│   └── modules/whats-new/ — préserver la feature complète pendant la réécriture
├── ios/Pulpe/
│   ├── App/
│   │   └── ✏️ PulpeApp.swift — combiner les nouveaux stores preview avec WhatsNewStore
│   └── Core/
│       ├── ✏️ Analytics/AnalyticsEvent.swift — conserver les événements des deux branches
│       └── ✏️ Network/Endpoints.swift — conserver les endpoints des deux branches
└── shared/
    ├── ✏️ index.ts — conserver tous les exports preview et What's New
    └── ✏️ schemas.ts — conserver les nouveaux schémas preview et le contrat What's New
```

## Tasks to do

### `1)` Préserver l'état local et réécrire la branche

> Rebaser sans perdre le rapport ni les nouveaux fichiers de plan non commités.

1. Fetcher `origin`, enregistrer les SHA de `HEAD` et `origin/preview`, puis vérifier la branche active.
2. Mettre de côté toutes les modifications locales, fichiers non suivis inclus, dans un stash nommé et vérifiable.
3. Rebaser la branche PUL-186 sur le `origin/preview` fraîchement récupéré.
4. Restaurer le stash uniquement après un rebase terminé, puis vérifier que le rapport et ce plan sont intacts.

### `2)` Réconcilier les chevauchements sans dérive

> Conserver simultanément les ajouts de preview et la feature What's New.

1. Résoudre chaque conflit éventuel fichier par fichier ; ne jamais choisir globalement un côté.
2. Vérifier les sept fichiers modifiés des deux côtés et l'absence de marqueurs de conflit.
3. Comparer l'ancien et le nouveau jeu de commits avec `git range-diff` pour détecter toute perte ou duplication.
4. Confirmer que le diff final contre `origin/preview` contient uniquement PUL-186 et ses documents AIDD.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le merge-base de `HEAD` et `origin/preview` est exactement le SHA courant de `origin/preview`, avec zéro commit cible manquant. |
| 1 | Le rapport de review et les fichiers de ce plan sont restaurés sans perte après le rebase. |
| 2 | Les apports de preview et de PUL-186 coexistent dans les sept fichiers chevauchants, sans marqueur de conflit ni suppression accidentelle. |
| 2 | Le `range-diff` ne révèle aucune modification fonctionnelle étrangère au rebase et le worktree ne contient que les documents AIDD attendus. |
