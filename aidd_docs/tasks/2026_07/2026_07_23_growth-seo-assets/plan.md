---
objective: "Pulpe dispose d'actifs d'acquisition qui composent dans le temps (blog SEO, pages comparatives, calculateur lead-magnet) et d'un kit de distribution prêt à envoyer, sans dépendre d'un canal payant."
status: pending
---

# Plan: Growth — actifs SEO & distribution pour faire connaître Pulpe

## Overview

| Field      | Value                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Traduire le playbook « 0→2M€ » en actifs concrets exécutables par l'IA : socle blog SEO, pages concurrents, calculateur budget, guides evergreen, kit outreach |
| **Source** | Texte brut : post « 15 leviers de croissance SaaS » fourni par Maxime + demande de filtrer sur ce qui est faisable en autonomie                     |

## Cadrage stratégique

Le diagnostic rétention (juillet 2026) dit : le mur est la première transaction, pas l'acquisition — pas de marketing massif tant que l'adoption transaction < 40-50 %. Ce plan est compatible : le SEO met 3 à 6 mois à porter. On construit les actifs **maintenant** pour qu'ils mûrissent pendant que la rétention se règle. Les leviers « burst » (Google Ads, lancement Product Hunt) sont préparés mais différés.

**Faits validés par recherche adversariale (juillet 2026), 10 clusters, 16 agents :**

- **Baseline mesurée (PostHog projet 87621, `$host='pulpe.app'`)** : ~28 pageviews/30 j (~16 visiteurs), ~5 pv organiques/mois, 70 % direct. Les KPIs SEO seront en **absolu** (visiteurs organiques/mois), pas en %. Le projet PostHog « Pulpe Landing » (75556) est mort (ancien domaine uniquement) — ne pas y mesurer.
- **Le gap SEO FR est réel mais la fenêtre se ferme** : BudgetHub (Innopulse GmbH, Zug) exécute déjà exactement ce playbook — section guides FR/DE, page `alternative-ynab-suisse` en français (mais faible : ~400 mots, pas de tableau, ne rank pas), pages « vs ». Les requêtes « alternative à YNAB gratuite » / « remplacer YNAB » ne servent QUE des listicles anglais. Time-sensitive.
- **« YNAB avis » est un terrain perdu** (Mustachian Post, pro-YNAB, MAJ juillet 2026 + sites France) — retiré des cibles.
- **La saisonnalité primes maladie est confirmée et datée** : annonce OFSP fin septembre chaque année (+4.4 % pour 2026, moyenne CHF 393.30, jeunes 19-25 CHF 326.30) ; hausse 2027 déjà télégraphiée (+3.7 % Comparis mai 2026, ~5 % OFSP). Le guide primes doit sortir **avant début septembre 2026**.
- **Toutes les affirmations concurrents des pages comparatives sont sourcées chez les éditeurs** (prix YNAB, tiers gratuits BudgetHub/Goodbudget/MoneyControl, BudgetCH gratuit associatif) — détail en phase 2.
- **Caveat méthodologique** : les SERPs ont été lues depuis un index US ; re-vérifier depuis une locale suisse (google.ch, fr-CH) avant de figer les briefs (tâche en phase 2).

**Mapping des 15 leviers → ce plan :**

| Levier du post                          | Verdict       | Où                                                                 |
| --------------------------------------- | ------------- | ------------------------------------------------------------------ |
| 1. ICP + groupes FB/communautés         | Partiel       | Phase 5 (communautés vérifiées avec leurs règles réelles, envoi = Maxime) |
| 2. Lead magnets                         | ✅ Exécutable | Phase 3 (calculateur budget interactif)                            |
| 4. Listicles / référencement externe    | Partiel       | Phase 5 (cibles vérifiées + contacts réels + emails rédigés)       |
| 7. Article sur un concurrent (gap SEO)  | ✅ Exécutable | Phase 2 (pages comparatives)                                       |
| 10. Articles news secteur               | ✅ Exécutable | Phase 4 (guides evergreen, angle primes maladie daté)              |
| 12. Lancement plateforme tierce         | Partiel       | Phase 5 (AlternativeTo immédiat/passif ; Product Hunt préparé, différé) |
| 6. SEO YouTube, 14. Webinaires          | ❌ Exclu      | Nécessitent tournage/présence humaine                              |
| 5. Affiliation, 9. Revente commission   | ❌ Exclu      | Pulpe est gratuit, pas de commission possible                      |
| 11. Relance base dormante               | ❌ Différé    | Aucune infra d'envoi email (pas de Resend/Brevo), RGPD à cadrer    |
| 13. Google Ads                          | ❌ Différé    | Budget + gate rétention                                            |
| 15. EdTech                              | ❌ Exclu      | Non pertinent pour un budget planner B2C                           |
| 3. Beta test / emails pré-launch        | ❌ N/A        | Pulpe est déjà lancé et gratuit                                    |

## Phases

| #   | Phase                                             | File                         |
| --- | ------------------------------------------------- | ---------------------------- |
| 1   | Socle blog SEO sur la landing (`/guides`)         | [`phase-1.md`](./phase-1.md) |
| 2   | Pages comparatives concurrents (gap SEO)          | [`phase-2.md`](./phase-2.md) |
| 3   | Lead magnet : calculateur de budget suisse        | [`phase-3.md`](./phase-3.md) |
| 4   | Guides evergreen Suisse romande (3 articles)      | [`phase-4.md`](./phase-4.md) |
| 5   | Kit distribution : listicles, communautés, directories | [`phase-5.md`](./phase-5.md) |

## Resources

| Source                                                                 | Verified                                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| https://www.ynab.com/pricing                                           | YNAB $14.99/mois ou $109/an, USD uniquement (« Exchange rates are not reflected »), pas de tier gratuit, une devise par budget |
| https://www.budgethub.ch/fr/guides/alternative-ynab-suisse             | La page FR concurrente existe mais est faible (~400 mots, pas de tableau, ne rank pas) — le gap de ranking est réel |
| https://budgethub.ch/preise                                            | BudgetHub : gratuit limité (2 comptes), CHF 6.90/11.90 par mois ; PWA, « Datenhaltung in der Schweiz, Compute in der EU » |
| https://apps.apple.com/fr/app/budgetch-app/id725506023                 | BudgetCH réel, gratuit, associatif (Budget-conseil Suisse), FR, MAJ juillet 2025           |
| https://goodbudget.com/signup                                          | Goodbudget gratuit = 20 enveloppes, 1 compte, 2 appareils ; payant $10/mois — sync bancaire US uniquement |
| https://www.bag.admin.ch/fr/newnsb/d2okh_kUK_OFhmMDfpyiy               | Primes 2026 : +4.4 %, moyenne CHF 393.30, jeunes 19-25 CHF 326.30 (annonce OFSP 23 sept 2025) |
| https://www.bfs.admin.ch/bfs/en.assetdetail.36195848.html              | Salaire médian suisse CHF 7'024/mois (ESS 2024, publié 2025)                               |
| https://www.moneyhaxx.ch/fr/calculateur                                | #1 sur « calculateur budget suisse » = moneyhaxx (Budget-conseil Suisse, marque jeunes, banques cantonales) — battable sur spécificité romande, pas sur autorité |
| https://alternativeto.net/faq                                          | Soumission par le maker OK, compte âgé d'1 semaine requis, claim ownership via support@alternativeto.net |
| https://help.producthunt.com/en/articles/479581-can-i-post-my-own-product-on-product-hunt | Product Hunt : self-post officiel, aucun hunter requis                   |
| https://forum.mustachianpost.com/guidelines                            | Self-promo interdite SAUF thread mensuel dédié (dernier mercredi) — seul slot sanctionné du paysage suisse |
| https://web.archive.org/web/20250517120126/https://www.reddit.com/r/Suisse/ | r/Suisse Règle 6 : pub interdite sauf « intérêt public » — contacter les mods d'abord |

## Decisions

| Decision                                                                 | Why                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Articles en pages TSX + layout `Article` partagé, pas de MDX ni CMS      | Vérifié : aucun tooling markdown installé, pattern `changelog` (TSX + data locale) déjà en place ; MDX seulement si > 5-10 articles |
| Route `/guides` (pas `/blog`)                                            | Contenu evergreen orienté requête SEO, pas un flux daté ; « guides » vend la valeur, pas la fraîcheur    |
| `app/sitemap.ts` remplace `public/sitemap.xml` (supprimé dans la même PR) | Vérifié : metadata routes fonctionnent sous `output: 'export'` ; le fichier statique (lastmod périmés) entrerait en collision |
| Pas de dépendance `pulpe-shared` dans la landing                         | Vérifié : le calcul onboarding = 3 sommes (~10 lignes) et `getCurrencyFormatter` force 2 décimales ≠ affichage adaptatif onboarding ; inline `Intl.NumberFormat('de-CH')` min 0 / max 2 |
| KPIs SEO en valeurs absolues, mesurés dans PostHog 87621 (`$host='pulpe.app'`) | Baseline ~28 pv/mois : les % seraient trompeurs ; le projet « Pulpe Landing » 75556 est dormant (ancien domaine) |
| Leviers payants/burst différés post-gate rétention (transaction ≥ 40 %)  | Diagnostic rétention 2026-07 : acquérir avant de retenir gaspille le trafic ; le SEO compense par son délai |
