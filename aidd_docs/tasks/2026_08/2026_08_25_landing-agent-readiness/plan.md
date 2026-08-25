---
objective: "pulpe.app exposes accurate, cache-safe agent entry points, recoverable 404s, verifiable trust information, and a prerendered homepage while preserving the current human experience."
status: blocked
---

# Plan: améliorer la lisibilité de la landing par les agents

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger les constats Is Agentic qui relèvent du site, prouver les réponses publiques, puis réutiliser le travail SEO existant pour le constat de marque. |
| **Source** | Rapport textuel Is Agentic transmis par Maxime le 25 août 2026 pour `https://pulpe.app` (score annoncé : 73/100, sept constats). |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Négociation Markdown et instructions agents | [`phase-1.md`](./phase-1.md) |
| 2   | Pages de confiance et identité Organization | [`phase-2.md`](./phase-2.md) |
| 3   | 404 récupérable et preuve du HTML sans JavaScript | [`phase-3.md`](./phase-3.md) |
| 4   | Activation de marque et vérification publique | [`phase-4.md`](./phase-4.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://acceptmarkdown.com/guides/accept-text-markdown | `text/markdown` est le media type enregistré ; les préférences et valeurs `q` doivent être respectées. |
| https://acceptmarkdown.com/guides/vary-accept | Chaque variante négociée doit annoncer `Vary: Accept`, éventuellement avec `Accept-Encoding`. |
| https://llmstxt.org/ | La v2 impose H1, résumé en blockquote, détails sans titre, puis listes de liens sous H2 ; elle recommande aussi `alternate` et `describedby`. |
| https://nextjs.org/docs/app/api-reference/file-conventions/proxy | Un proxy Next peut négocier sur l'en-tête de requête ; il n'est pas disponible avec `output: "export"`. |
| https://github.com/vercel/next.js/issues/85999 | Next 16 écrase actuellement un `Vary` personnalisé sur les réponses HTML App Router ; le proxy seul ne peut donc pas garantir l'en-tête final. |
| https://nextjs.org/docs/app/api-reference/file-conventions/not-found | `global-not-found.tsx` est le bon point d'entrée pour un 404 global avec plusieurs root layouts et conserve un statut 404. |
| https://schema.org/Organization | `contactPoint` accepte un `ContactPoint` et `address` un `PostalAddress`. |
| https://vercel.com/docs/project-configuration/vercel-json | Les en-têtes et routes Vercel peuvent être vérifiés en preview sans remplacer les règles de sécurité existantes. |
| https://pulpe.app/ | Vérifié le 25 août 2026 : `200 text/html`, même corps pour `Accept: text/markdown`, aucun `Vary`. |
| https://pulpe.app/llms.txt | Vérifié le 25 août 2026 : 404. |
| https://pulpe.app/this-path-does-not-exist-agent-audit | Vérifié le 25 août 2026 : vrai 404 HTML, mais seulement des sorties vers l'accueil et l'app. |

## Decisions

| Decision | Why |
| -------- | --- |
| Remplacer l'export pur par le rendu statique Next avec un proxy limité aux chemins publics | Un matcher Vercel statique ne classe pas correctement toutes les valeurs `q` et `q=0`; le proxy permet une négociation conforme tout en laissant les pages pré-rendues. |
| Verrouiller Next 16.3.1 et corriger son runtime App Page dans `prebuild` avec un motif exact | Next écrase actuellement tout `Vary` configuré après le proxy et son runtime est précompilé sur une seule ligne. Le garde de build reste minuscule, idempotent, testé, exécuté malgré `installCommand --ignore-scripts`, et échoue explicitement dès que la version ou le motif change. |
| Ne pas « ajouter du SSR » à la homepage | La production livre déjà 6 000+ caractères, un H1 et une hiérarchie H1/H2/H3/H4 dans le HTML brut ; le constat doit être sécurisé par un test, pas par une migration inutile. |
| Publier `/about` et `/privacy` en français, sans remplacer la politique complète de l'app | L'audit porte sur les ancres racine de `pulpe.app`; la politique Angular reste le document légal détaillé et la nouvelle page la référence explicitement. |
| Réutiliser le kit SEO existant au lieu de créer une seconde campagne | `2026_07_23_growth-seo-assets` contient déjà les cibles, messages, annuaires et règles ; le rang de marque dépend ensuite d'actions et de délais externes. |
