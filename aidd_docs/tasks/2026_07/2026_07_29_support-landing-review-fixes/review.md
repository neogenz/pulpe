# Review: Corriger la revue de la page Support

- **Verdict**: approve
- **Diff**: `origin/preview...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_29
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Fermer les findings de la page Support

- [x] Le test échoue si le lien vers les paramètres, la hauteur des actions de contact ou le fallback vers `plainAnswer` disparaît — `landing/app/accessibility.test.tsx:953`
- [x] Les quatre réponses enrichies conservent les mêmes faits et libellés de lien dans leur rendu visible et leur `plainAnswer` — `landing/app/accessibility.test.tsx:979`
- [x] Le mot « paramètres » mène à `/settings` via `angularUrl` avec `utm_content=faq_delete_account`, tandis que le JSON-LD reste du texte brut — `landing/app/support/page.tsx:19`
- [x] Chaque réponse sans lien ne déclare son texte qu'une fois et reste rendue par `AccordionItem` — `landing/app/support/page.tsx:27`
- [x] Les deux liens de contact offrent une hauteur minimale de 44 px ; les liens intégrés aux réponses gardent leur rendu inline — `landing/app/support/page.tsx:207`
- [x] Aucun composant, fichier de données ou style global n'est ajouté ou modifié — `landing/app/support/page.tsx:1`
- [x] Les tests, le lint, le contrôle de types et `pnpm quality` passent — `landing/package.json:18`
- [x] À 390 px, la section contact ne déborde pas et ses deux actions restent dans l'ordre attendu — `landing/app/support/page.tsx:195`
- [x] La revue finale ne contient plus de finding `fit`, `conform` ou `code` lié aux trois constats d'origine — `aidd_docs/tasks/2026_07/2026_07_29_support-landing-review-fixes/review.md:8`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (9/9) |
| Files checked | `landing/app/support/page.tsx`, `landing/app/accessibility.test.tsx`, `landing/components/sections/FAQ.tsx`, `landing/components/ui/AccordionItem.tsx`, `landing/components/ui/Section.tsx`, `landing/components/sections/FinalCTA.tsx`, `aidd_docs/tasks/2026_07/2026_07_29_support-landing-review-fixes/phase-1.md` |
| Unchecked     | none |
| Unplanned     | none |
