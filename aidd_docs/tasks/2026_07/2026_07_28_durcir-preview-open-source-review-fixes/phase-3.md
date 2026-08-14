---
status: done
---

# Instruction: Fermer les contournements analytics web et iOS

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/MONITORING.md ✏️
├── frontend/projects/webapp/src/app/core/analytics
│   ├── posthog-sanitizer.ts ✏️
│   └── posthog-sanitizer.spec.ts ✏️
└── ios
    ├── Pulpe/Core/Analytics/AnalyticsService.swift ✏️
    └── PulpeTests/Core/Analytics/AnalyticsServiceTests.swift ✏️
```

## Tasks to do

### `1)` Rendre le sanitizer iOS récursif

> Une propriété sûre en surface ne doit pas pouvoir transporter un secret imbriqué.

1. Faire traiter par `sanitizeProperties` les dictionnaires `[String: Any]` et tableaux imbriqués.
2. À chaque niveau, appliquer les mêmes règles financières, secrets et contenus saisis; conserver les valeurs primitives sous une clé sûre.
3. Préserver uniquement au niveau des propriétés de personne les champs explicitement autorisés `email`, `name` et `supabase_user_id`.
4. Ajouter une régression unique mêlant dictionnaire, tableau, montant, token, libellé et valeur technique visible.

### `2)` Fermer les URLs sensibles côté web

> Les paramètres de query doivent employer la même règle que le reste du payload.

1. Dans la boucle des query params, supprimer une clé si elle est dans la liste protégée ou si `isSensitiveProperty` la classe sensible.
2. Couvrir au minimum `access_token`, `refresh_token`, `password` et `recovery_key`, en plus des paramètres déjà protégés.
3. En cas d’URL non analysable, retourner une valeur vide plutôt que le texte original partiellement masqué.
4. Conserver le masquage des segments dynamiques et les paramètres ordinaires utiles.

### `3)` Aligner les déclarations de monitoring

> Documenter la collecte réellement livrée, sans promesse plus large.

1. Remplacer l’affirmation d’email masqué par la description exacte : UUID Supabase, email et prénom sont identifiés pour le support.
2. Indiquer que PostHog est configurable en local et preview et actif en production selon les variables de chaque environnement.
3. Maintenir l’interdiction documentée des montants, contenus saisis, tokens, clés de récupération et replay production.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Aucune sentinelle montant, token, clé de récupération ou texte métier ne survit dans un dictionnaire ou tableau iOS imbriqué; les champs techniques sûrs restent présents. |
| 2 | Une URL absolue, relative ou protocol-relative perd tous ses paramètres sensibles et garde ses paramètres sûrs ainsi que son format. |
| 2 | Une entrée que `URL` ne peut pas analyser ne ressort jamais telle quelle dans un événement PostHog. |
| 3 | `MONITORING.md` décrit l’identification email/prénom, les environnements configurables et les exclusions exactement comme le code et les tests. |
