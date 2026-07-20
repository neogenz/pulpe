---
status: pending
---

# Instruction: Préserver la catégorie et l'existence des décisions

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/modules/whats-new/domain/
└── releases-data.parity.spec.ts ✏️ conserver les catégories feature/fix
frontend/projects/webapp/src/app/layout/whats-new/
└── whats-new-releases.spec.ts ✏️ relier les silences web au changelog Changesets
```

## Tasks to do

### `1)` Conserver la catégorie éditoriale iOS

1. Prouver qu'une feature landing déplacée dans les fixes projetés passe le contrat actuel.
2. Valider séparément les sous-ensembles `features` et `fixes`.
3. Conserver les contrôles d'unicité et de projection non vide.

### `2)` Refuser les silences web fantômes

1. Prouver qu'une entrée `SKIPPED_RELEASES` absente de `frontend/CHANGELOG.md` passe les invariants actuels.
2. Exiger un titre de version Changesets exact pour chaque silence web.
3. Conserver le mode `--skip-whats-new`, qui omet volontairement le changelog public landing.
4. Conserver les invariants de version courante, SemVer, raison et exclusion mutuelle.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                 |
| ---- | --------------------------------------------------------------------------------------------------- |
| 1    | Une nouveauté ne peut pas être affichée sous « Corrections », ni l'inverse, dans le dialogue iOS    |
| 2    | Toute version web silencieuse existe dans le changelog privé, y compris sans entrée landing publique |
