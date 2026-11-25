---
status: pending
---

# Instruction: Android, parité PUL-377 et PUL-378

Android suit iOS (`phase-7.md`, `phase-8.md`) : mêmes fonctions, mêmes textes, seul le rendu est Android (Material, feuilles, chips). Le graphique de répartition de « Mon patrimoine » reste tel quel.

## Architecture projection

```txt
android/src/
├── core/api/endpoints.ts ✏️ (route d'écartement retirée)
├── core/i18n/catalogs/{fr,en,de,it}.json ✏️
├── app/(main)/(tabs)/net-worth.tsx ✏️
├── app/(main)/(tabs)/(home)/settings/preferences.tsx ✏️
├── app/(main)/(tabs)/(home)/settings/default-account.tsx ✅
├── core/testing/net-worth-accounts.ts ✅ (jeu d'essai des specs)
├── features/net-worth/
│   ├── net-worth-sections.ts ✏️ (légende « depuis ta saisie », fin des suggestions)
│   ├── net-worth-api.ts, net-worth-queries.ts ✏️
│   ├── account-link.ts ✅ (règles CA2, CA4, CA25, CA26, CA29, CA45)
│   ├── use-account-selection.ts ✅
│   └── components/{asset-group-card,asset-form-sheet}.tsx ✏️ · account-field.tsx ✅
├── features/transactions/{transaction-draft.ts,components/transaction-sheet.tsx} ✏️ (annuler renvoie le compte)
├── features/budget-details/components/budget-line-sheet.tsx ✏️
├── features/templates/components/template-line-sheet.tsx ✏️
```

## Partie A, PUL-377

1. Ligne d'un élément : si `latestValue` a bougé depuis `recordedValue`, « +500.00 CHF depuis ta saisie du 24 novembre » (signe U+2212 pour un négatif, « Catégorie · » en tête sous « Découverts »), sinon la légende d'âge existante.
2. Feuille de modification : champ prérempli avec `latestValue`, rappel « Ta dernière saisie : <recordedValue signé>, le <date> ».
3. Retrait de l'interface « Je propose / Appliquer / Écarter » et de l'appel à la route d'écartement ; texte de l'introduction aligné sur le web et iOS.

Tests : `net-worth-sections.spec.ts` et `net-worth-rows.spec.tsx` (CA8, CA9), `asset-form-draft.spec.ts` et `asset-form-sheet.spec.tsx` (CA10).

## Partie B, PUL-378

1. `account-link.ts` : sélecteur absent flag éteint ou sans élément actif (CA2) ; prérempli par le compte par défaut actif à la création (CA29) ; `accountId` toujours envoyé à la création d'un mouvement libre, `null` pour « Aucun » (CA3) ; jamais sur un mouvement rattaché à une prévision (CA4) ; omis au PATCH tant que le champ n'a pas bougé (CA26) ; même élément que le lien existant de la prévision refusé avec le message de la règle (CA25) ; lien égal au compte prérempli : « Aucun » (CA45).
2. `AccountField` : un champ « Compte » qui ouvre, au-dessus de la feuille, la liste « Aucun », « Ce que j'ai », « Ce que je dois » (`AccountChoiceList`, partagée avec l'écran « Compte par défaut »). Un menu Paper s'afficherait derrière la feuille native.
3. Branchement dans `TransactionSheet`, `BudgetLineSheet` (lissage compris), `TemplateLineSheet`. La réouverture après suppression d'un mouvement libre renvoie son compte.
4. Réglage « Compte par défaut » : ligne dans Préférences (section « Mon budget »), écran de choix, `PUT /v1/users/settings` `defaultAccountId` (CA28, CA34). Absent flag éteint ou sans élément actif.
5. Menu d'un élément actif : « Utiliser par défaut dans le budget » / « Ne plus utiliser par défaut », pastille « Par défaut » (CA47, CA33). Archiver ou supprimer le compte par défaut recharge le réglage (CA35).
6. Rapprochement : `accountId: null` (CA44), prouvé de bout en bout par un test qui ne simule que la couche HTTP.
7. Ligne « Compte par défaut » de Préférences : le nom du compte en description (pas en valeur, le titre se tronquait à l'échelle 1,3) ; l'aide reste sur l'écran de choix. Entrée de menu élargie (Paper plafonne à 280dp). Erreur CA25 affichée seulement en cas de conflit.

Tests : `account-link.spec.ts` (règles), les feuilles `transaction-sheet.spec.tsx`, `budget-line-sheet.spec.tsx`, `template-line-sheet.spec.tsx` (CA1 à CA4, CA22, CA23, CA25, CA26, CA29), `default-account-setting.spec.tsx` (CA28, CA34, CA35), `net-worth-default-account.spec.tsx` et `net-worth-screen-intro.spec.tsx` (CA35, CA47), `reconcile-accounts-sheet.spec.tsx` (CA44, « posts the gap movement with accountId null »).

## Contrôles

`pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm exec prettier --check .`, `pnpm exec jest` depuis `android/` ; `pnpm test:lexicon` à la racine.
