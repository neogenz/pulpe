---
objective: "Une personne germanophone en Suisse peut lire, sur Pulpe, deux pages de conseils originales en allemand standard suisse : l’une répond à la recherche d’une app de budget utilisable en Suisse, l’autre explique comment provisionner les primes maladie 2026 dans l’année."
status: reviewed
---

# Plan: deux pages de conseils en allemand suisse

## Overview

| Field      | Value                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Publier deux articles DE originaux (`beste-budget-app-schweiz`, `krankenkassenpraemien-budgetieren`) sans calquer le FR ni toucher l’accueil. |
| **Source** | [`spec.md`](./spec.md) — 18 août 2026                                                                                                 |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Chrome d’article localisable, registre DE à part   | [`phase-1.md`](./phase-1.md) |
| 2   | Page comparatif Budget-App Schweiz                 | [`phase-2.md`](./phase-2.md) |
| 3   | Page Prämien provisionner + câblage sitemap/footer | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                                         | Verified                                                                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [BAG — Prämien und Kosten FAQ (DE)](https://www.bag.admin.ch/de/praemien-und-kosten-antworten-auf-haeufige-fragen) | Hausse 2026 **4,4 %** ; mittlere Prämie **393.30 Franken**/Monat. Angle du guide = budget, pas le changement de caisse. |
| [BAG — communiqué 23.09.2025](https://www.bag.admin.ch/de/newnsb/d2okh_kUK_OFhmMDfpyiy)         | Jeunes adultes (19–25) : mittlere Prämie **326,30 Franken**. Adulte 465,30 ; enfant 122,50.       |
| [docs/I18N.md](../../../../docs/I18N.md)                                                       | DE = **du / dein**, jamais Sie. Lexique : Planung, Ausgabe, Sparen, Verfügbar zum Ausgeben, Bewegungen. |
| [Next.js `generateStaticParams`](https://github.com/vercel/next.js/blob/canary/docs/01-app/03-api-reference/04-functions/generate-static-params.mdx) | L’enfant s’exécute une fois par `params` parent. Renvoyer `[]` si `lang !== "de"`. Sous `output: 'export'`, pas de `dynamicParams: true`. |
| [landing/DESIGN.md](../../../../landing/DESIGN.md)                                             | `min-h-11`, registre tu/du, apostrophe suisse, un h1, un CTA primaire.                            |

## Decisions

| Decision                                                                                                                                                          | Why                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Registre `DE_GUIDES` séparé de `GUIDES`. Les pages vivent sous `app/[lang]/budget-ratgeber/[slug]/`.                                                              | Le test FR « une page par entrée de registre » pointe `app/(fr)/conseils-budget/`. Mélanger les slugs DE y ferait échouer le build FR.                 |
| `generateStaticParams` enfant : `[]` si `lang !== "de"`, sinon les deux slugs. Pas de dossier `app/de/` à côté de `app/[lang]/`.                                  | Next croiserait sinon `/en/…` et `/it/…`. Un segment `de` parallèle à `[lang]` entre en conflit.                                                       |
| Ces URLs restent **hors** `ROUTES`. Sitemap **sans** `alternates`. Pas de hreflang FR↔DE.                                                                         | `ROUTES` = pages des quatre langues. Les y mettre pointerait des 404. Les slugs et l’intention diffèrent du FR : ce ne sont pas des traductions.       |
| Pas d’index DE. Lien retour = Startseite `/de`. Footer : deux liens `germanOnly` vers les articles, libellés allemands hors dictionnaires produit.                | Le spec interdit de traduire l’index. Un hub vide ou un calque `/de/conseils-budget` serait du bruit.                                                  |
| Chrome d’article (dates, FAQ, CTA, JSON-LD `inLanguage`) paramétré ; défaut = FR actuel. Copie chrome DE dans un module guides, pas dans les 4 catalogues.        | `ArticleLayout` est codé en dur FR. Sans paramètre, les pages DE sortent bilingues. EN/IT n’ont pas ces pages : des clés vides pollueraient le contrat. |
| Slugs natifs : `/de/budget-ratgeber/beste-budget-app-schweiz` et `/de/budget-ratgeber/krankenkassenpraemien-budgetieren`. Section `budget-ratgeber`, pas `conseils-budget`. | Requêtes allemandes, pas un préfixe collé sur un slug français.                                                                                        |
