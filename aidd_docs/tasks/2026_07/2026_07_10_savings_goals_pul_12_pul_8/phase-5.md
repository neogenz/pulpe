---
status: done
---

# Instruction: Retirer le contrat mort et aligner la documentation

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
shared/
├── schemas.ts                                                       ✏️ retirer templateAdjustments définitivement
└── src/savings-goal-pul12.spec.ts                                  ✏️ contrat strict final
backend-nest/src/modules/savings-goal/
├── application/apply-savings-goal-plan.use-case.ts                 ✏️ type final sans template
└── domain/
    ├── savings-goal.entity.ts                                      ✏️ retirer le type template
    └── ports/savings-goal-repository.port.ts                       ✏️ contrat writer final
docs/
├── SAVINGS.md                                                       ✏️ horizon maximal
├── SAVINGS_PLAN.md                                                  ✏️ slider réel, provisioning, FX, atomicité
├── SAVINGS_PROGRESS.md                                              ✏️ retirer le leg template annoncé
└── SPREAD.md                                                        ✏️ conservation savingsGoalId
aidd_docs/tasks/2026_07/2026_07_12_savings_goals_ios_intro/
├── phase-1.md                                                       ✏️ deux pages
└── phase-2.md                                                       ✏️ a11y et previews sur deux pages
```

## Tasks to do

### `1)` Fermer la transition du contrat

> Le public API ne doit plus annoncer un mécanisme sans appelant.

1. Vérifier une dernière fois que la feature n'est pas contenue dans une branche livrée et que web/iOS n'envoient plus `templateAdjustments`.
2. Retirer le champ du `strictObject`, les types, paramètres et commentaires restants.
3. Ajouter le test qui rejette désormais `templateAdjustments` comme clé inconnue.
4. Vérifier Swagger, repository et use case avec la signature SQL introduite en phase 2.

### `2)` Aligner les sources de vérité

> La documentation doit décrire le comportement vérifié, pas l'intention initiale.

1. Documenter le provisioning à la confirmation, ses préconditions et la conservation des budgets après échec final.
2. Remplacer le dénominateur `openMonths.length` par l'horizon contributif provisionnable.
3. Aligner l'ancrage et les formules de `sliderMax` sur le code livré, avec les éventuelles différences web/iOS explicitement assumées.
4. Documenter la remise à zéro des métadonnées FX source après un ajustement en devise du compte.
5. Documenter la conservation du rattachement lors du lissage.
6. Corriger les deux phases de l'intro iOS de trois pages vers deux.

### `3)` Exécuter la vérification transversale

> Prouver chaque finding avec le test ciblé puis les gates du monorepo.

1. Construire `shared` avant les clients.
2. Exécuter les tests shared du plan et des schémas, les tests backend unitaires et intégration Supabase, les specs Angular ciblées et les tests Swift ciblés.
3. Régénérer les types DB après application locale de la migration, sans commande Supabase destructive.
4. Exécuter `pnpm quality`, puis `pnpm test`; conserver les sorties décisives dans le compte rendu d'implémentation.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le contrat final accepte les deux jambes actives et rejette toute clé `templateAdjustments`. |
| 2 | Les docs décrivent 120 mois, le provisioning, la frontière d'atomicité, le FX, le lien de lissage et deux pages iOS. |
| 3 | Chaque test de régression ciblé passe, puis `pnpm quality` et `pnpm test` terminent avec un code 0. |
