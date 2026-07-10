---
status: done
---

# Instruction: Focus et accordéon accessibles

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── aidd_docs/tasks/2026_07/2026_07_10_fix_landing_focus_accessibility
│   ├── plan.md ✏️
│   └── phase-1.md ✏️
└── landing
    ├── app
    │   ├── accessibility.test.tsx ✅
    │   └── globals.css ✏️
    ├── components/ui/AccordionItem.tsx ✏️
    └── package.json ✏️
```

## Tasks to do

### `1)` Écrire les régressions

> Prouver les deux défauts avant de les corriger.

1. Vérifier que les règles de focus ne redéfinissent pas la géométrie des composants.
2. Vérifier que le panneau FAQ replié est masqué des technologies d’assistance.
3. Raccorder le test Node au script `test` de la landing.

### `2)` Corriger les états accessibles

> Préserver les formes existantes et aligner l’arbre d’accessibilité sur l’état visuel.

1. Laisser les composants fournir leur propre `border-radius` pendant le focus.
2. Exposer l’état masqué du panneau FAQ avec `aria-hidden`.

### `3)` Valider la landing

> Confirmer le contrat ciblé et l’intégrité du build de production.

1. Exécuter les tests de la landing.
2. Exécuter le build de production de la landing.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le test échoue sur le commit initial pour les deux régressions identifiées.                                               |
| 2    | Les boutons arrondis conservent leur rayon au focus et une réponse FAQ repliée est masquée des technologies d’assistance. |
| 3    | Les tests et le build de production de la landing terminent avec un code de sortie nul.                                   |
