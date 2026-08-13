---
objective: "La landing sert des guides budget suisses depuis /guides : ajouter un guide au registre le publie dans l'index, le sitemap et les données structurées, dans une forme optimisée pour Google ET les moteurs de réponse IA (ChatGPT, Perplexity, AI Overviews)."
status: implemented
---

# Plan: PUL-296 — Socle SEO/GEO `/guides` sur la landing

## Overview

| Field      | Value                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Registre typé + layout article + styles prose + sitemap dynamique + article seed, avec les pratiques GEO/AEO 2026 intégrées au socle (pas en couche ajoutée)     |
| **Source** | Ticket Linear PUL-296 + spec `2026_07_23_growth-seo-assets/phase-1.md` (récupérée du worktree `pulpe-growth-axes-5075bf`, non commitée sur `preview`)            |

## Cadrage GEO/AEO (recherche août 2026)

Le socle vise deux lecteurs : le crawler Google classique et les moteurs de réponse IA.
Ce qui compte réellement, vérifié par recherche dédiée :

- **Déjà acquis par l'architecture** : HTML statique complet au rendu serveur (`output: 'export'`), robots.txt allow-all, CSP compatible JSON-LD inline. Rien à changer, ne pas le casser.
- **À intégrer au socle** : réponse directe (40–80 mots) en tête d'article, H2 formulés en questions, étapes numérotées, chiffres suisses sourcés, FAQ visible strictement identique au JSON-LD `FAQPage`, `datePublished`/`dateModified` réels, entité `Organization` reliée aux articles.
- **À ne PAS faire** : llms.txt (consommé par aucun moteur majeur, verdict Google mai 2026), blocage de crawlers IA dans robots.txt, MDX/CMS.
- **Hors code, conditionne la visibilité ChatGPT** : l'index Bing (ChatGPT search cite ~75–87 % de résultats Bing). Action ops post-merge : soumettre le sitemap à Bing Webmaster Tools.

## Phases

| #   | Phase                                                        | File                         |
| --- | ------------------------------------------------------------ | ---------------------------- |
| 1   | Socle : registre typé, layout article, prose CSS             | [`phase-1.md`](./phase-1.md) |
| 2   | Index `/guides` + article seed GEO-structuré                 | [`phase-2.md`](./phase-2.md) |
| 3   | Découvrabilité : sitemap dynamique, entité Organization, maillage | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                                       | Verified                                                                                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| https://codersera.com/blog/llms-txt-complete-guide-2026/                                     | llms.txt non consommé par OpenAI/Google/Anthropic pour la découverte web (guide Google mai 2026) — on le skip  |
| https://gugubrand.com/en/blog/allow-ai-crawlers-robots-txt-guide/                             | Posture robots.txt : autoriser GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot — déjà le cas (`*`)  |
| https://www.clickrank.ai/how-to-get-indexed-in-chatgpt-search/                               | Facteurs de citation IA : réponse 40–80 mots, format Q&A, étapes numérotées, fraîcheur `dateModified`         |
| https://ailabsaudit.com/blog/en/schema-markup-ai-visibility-guide/                           | Types JSON-LD utiles 2026 : FAQPage + Organization + Article liés en `@graph` ; le schema doit refléter la page |
| https://www.shadow.inc/resources/how-to-rank-on-chatgpt                                      | ChatGPT search dépend de l'index Bing ; HTML rendu serveur indispensable (le JS-only est mal parsé)            |
| https://www.relevantaudience.com/seo/ai-overview-impact-on-organic-search-2026/              | AI Mode (avr. 2026) écrase le CTR organique ; être cité dans la réponse IA prime sur le rang classique         |

> Chiffres précis de ces sources (lift 2.5x, seuils FCP…) = blogs SEO, à prendre comme directionnels, pas comme des faits.

## Decisions

| Decision                                                                                       | Why                                                                                                                          |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Articles en TSX + registre local typé, pas de MDX ni CMS                                       | < 10 articles ; pattern `changelog` (TSX + data locale) déjà en place ; zéro dépendance ajoutée                               |
| `app/sitemap.ts` remplace `public/sitemap.xml`, supprimé dans la même PR                       | Collision de chemin sinon ; metadata routes compatibles `output: 'export'` (vérifié, spec juillet 2026)                        |
| Pas de llms.txt                                                                                | Aucun moteur majeur ne le lit (Google, mai 2026) ; dette de maintenance sans signal                                            |
| robots.txt reste `User-agent: * / Allow: /`                                                    | Bloquer Google-Extended ou GPTBot supprime la visibilité AI Overviews / ChatGPT ; la posture actuelle est déjà optimale        |
| La FAQ visible et le JSON-LD `FAQPage` sortent de la MÊME source de données                    | Un schema qui diverge de la page = pénalité de confiance chez les moteurs IA ; le layout impose la cohérence par construction  |
| `updatedAt` obligatoire au registre, propagé à `dateModified` (JSON-LD) et `lastmod` (sitemap) | La fraîcheur est un signal de citation IA confirmé ; une seule édition au registre met tout à jour                             |
| Entité `Organization` (+ `sameAs`) au layout racine, `publisher`/`author` des articles la référencent | Clarté d'entité = facteur GEO confirmé ; évite de dupliquer l'entité dans chaque article                                 |
