# Directories, ASO, mesure

Phrase d’entité : *Pulpe est une app de budget pour planifier son année, sans connexion bancaire.*

## AlternativeTo — immédiat (gate d’âge ~1 semaine)

Action jour 0 (humaine) : créer le compte. Ne pas soumettre le jour même.

- Facettes : iPhone, Web, freemium (en pratique gratuit sans plafond), EU-based
- Description :

```
Pulpe is a budget app for planning your year. You set up a typical month, place taxes and holidays where they belong, and see what you’ll have left in the months ahead. No bank connection. Free. Open source. French, English, German, Italian.
```

- Suggest as alternative on the YNAB page (~398 alternatives)
- Claim ownership : support@alternativeto.net depuis une adresse @pulpe.app
- Ne jamais incentiver les votes (pénalisé)

## Product Hunt — différé (gate rétention ≥ 40 %)

- Self-post autorisé, pas besoin de hunter
- Tagline : `Plan your year. See what you’ll have left.`
- Description ≤ 260 car. : `A budget app for planning the year ahead. No bank connection, no ads, open source. Web + iPhone.`
- Thumbnail 240×240, ≥ 2 visuels 1270×760 (screenshots App Store existants)
- Premier commentaire maker prêt ; lancement mar–jeu 12:01 PST
- Cadre : backlink / crédibilité, audience EN ≠ ICP romand

## ASO App Store (copie à coller dans App Store Connect)

- Subtitle : `App de budget — planifie l’année`
- Première ligne : `Pulpe est une app de budget pour planifier ton année et voir combien il te restera chaque mois.`
- Mots-clés (FR) : `budget,gestion,planification,epargne,finances,depenses,suisse,france`
- Ne pas mettre « suisse » dans le nom de l’app
- Demander une note aux trois témoins déjà cités sur la landing, sans contrepartie

## Autres annuaires

| Cible | Trigger | Note |
| --- | --- | --- |
| Les Pépites Tech | Immédiat, formulaire gratuit, section Suisse | Cible FR principale |
| startupticker.ch | Jalon réel, news@startupticker.ch | Société + fondateur plein temps : éligibilité incertaine |
| swiss made software | Ne pas soumettre | CHF 120/an, personne morale requise |

Retirés : SICTIC, digitalswitzerland, Venturelab TOP 100.

## Mesure SEO (PUL-304)

- Search Console : meta `google-site-verification` déjà dans le layout. **Ne pas** cibler un seul pays (Suisse fermerait la France). Laisser mondial.
- Demander l’indexation de `/conseils-budget`, des nouveaux guides, `/calculateur-budget`.
- Dashboard : [SEO landing pulpe.app](https://eu.posthog.com/project/87621/dashboard/902840) — pageviews, unique visitors, pathname, referrers. Filtre `$host=pulpe.app`.
- Baseline juil. 2026 (PostHog 87621) : ~28 pageviews / 30 j, ~16 visiteurs, ~5 pv organiques / mois, 70 % direct. KPIs en **absolu**.
- Projet PostHog « Pulpe Landing » 75556 : **à archiver** — ancien domaine seulement. Mesurer uniquement dans 87621.
- Prompts IA à logger (ChatGPT, Gemini, Perplexity, AI Mode) : « app de gestion de budget », « app de budget sans banque », « planifier son budget sur l’année », puis variantes CH et FR.
