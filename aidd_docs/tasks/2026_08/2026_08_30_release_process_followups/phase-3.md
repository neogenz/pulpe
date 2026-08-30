---
status: pending
---

# Instruction: Tolérer uniquement le 404 staging transitoire

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .github/
│   ├── scripts/ci-security.test.mjs                    ✏️ couvre retry étroit et échecs fermés
│   └── workflows/staging-proof.yml                     ✏️ remet un statut 404 dans la boucle
└── docs/DEPLOYMENT.md                                  ✏️ décrit le comportement observé
```

## Tasks to do

### `1)` Réessayer le seul état transitoire confirmé

> Un déploiement listé peut précéder brièvement son endpoint de statuts.

1. Faire retourner un état vide à `deployment_state` uniquement sur HTTP 404.
2. Conserver l'échec immédiat pour authentification, quota, serveur, JSON invalide, provider en échec ou déplacement de `main`.
3. Verrouiller ces branches dans `ci-security.test.mjs` et documenter le rerun désormais inutile.
4. Fusionner la PR de hardening après les tests ciblés et `pnpm quality`; vérifier la preuve staging réelle de son merge.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Un 404 de statut transitoire reste dans la boucle bornée; toute autre erreur ou dérive échoue, et le merge obtient sa preuve staging sans rerun manuel. |
