---
status: pending
---

# Instruction: Clore le refactor historique

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── CONTRIBUTING.md                                                   ✏️ fusionne le parcours opérateur final de #703
├── docs/
│   ├── CI.md                                                         ✏️ fusionne les mesures post-cutover
│   ├── DEPLOYMENT.md                                                 ✏️ fusionne reprise et audit observés
│   └── POSTHOG_RELEASES.md                                           ✏️ consigne l'échec PostHog historique
└── aidd_docs/
    ├── memory/deployment.md                                          ✏️ enregistre les invariants de déploiement
    ├── memory/vcs.md                                                 ✏️ enregistre les invariants Git
    └── tasks/2026_08/2026_08_22_ci_release_reliability/
        ├── plan.md                                                   ✏️ passe le plan historique à complete
        ├── phase-9.md                                                ✏️ passe le cutover à complete
        └── phase-10.md                                               ✏️ passe les mesures à complete
```

## Tasks to do

### `1)` Actualiser et fusionner #703

> Fermer l'historique avant d'ajouter de nouveaux correctifs.

1. Remettre la branche de #703 sur le `main` qui contient #705 et #707.
2. Vérifier que seuls ses neuf fichiers documentaires changent et que phases 9-10 restent marquées terminées.
3. Attendre `✅ CI Success`, fusionner sans bypass, puis vérifier les trois déploiements staging exacts du merge.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1    | #703 est fusionnée sur le `main` courant; le merge n'a perdu aucun correctif récent et n'a déclenché aucun déploiement production. |
