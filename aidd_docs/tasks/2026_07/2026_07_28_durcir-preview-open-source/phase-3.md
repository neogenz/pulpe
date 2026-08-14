---
status: done
---

# Instruction: Éliminer les fuites opérationnelles

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── pnpm-lock.yaml ✏️
├── docs/MONITORING.md ✏️
├── backend-nest
│   ├── .env.example ✏️
│   ├── README.md ✏️
│   ├── package.json ✏️
│   └── src
│       ├── app.module.ts ✏️
│       ├── main.ts ✏️
│       ├── config
│       │   ├── environment.ts ✏️
│       │   └── environment.spec.ts ✏️
│       ├── common
│       │   ├── filters
│       │   │   ├── global-exception.filter.ts ✏️
│       │   │   └── global-exception.filter.spec.ts ✏️
│       │   ├── middleware/response-logger.middleware.ts ✏️
│       │   ├── services
│       │   │   ├── turnstile.service.ts ✏️
│       │   │   └── turnstile.service.spec.ts ✏️
│       │   └── utils
│       │       ├── log-anonymization.ts ✏️
│       │       └── log-anonymization.spec.ts ✏️
│       ├── modules/transaction/application
│       │   ├── search-transactions.use-case.ts ✏️
│       │   └── search-transactions.use-case.spec.ts ✏️
│       └── test/redaction.spec.ts ✏️
└── ios
    ├── Pulpe/Core/Network/APIClient.swift ✏️
    └── PulpeTests/Core/Network/APIClientClientKeyHeaderTests.swift ✏️
```

## Tasks to do

### `1)` Verrouiller le mode détaillé par environnement

> Garder le diagnostic preview sans permettre son activation en production.

1. Centraliser la décision du mode HTTP: standard par défaut, détaillé seulement sur opt-in en `development` ou `preview`.
2. Forcer le mode standard dès que `NODE_ENV=production` ou `RAILWAY_ENVIRONMENT_NAME=production`, même si l’autre valeur ou le flag de debug est mal configuré.
3. Émettre au démarrage un warning de sécurité si une demande de mode détaillé est ignorée en production.

### `2)` Assainir les détails sans les rendre inutiles

> Les données de diagnostic peuvent rester visibles; les secrets restent toujours masqués.

1. Garder la redaction active dans tous les modes et appliquer un sanitizer récursif, insensible à la casse, aux headers, query, body et réponses.
2. Masquer au minimum authorization, cookies, tokens, mots de passe, PIN, clés clientes et clés de récupération, y compris dans les objets et tableaux imbriqués.
3. Tronquer les payloads volumineux et retirer la génération cURL, qui duplique headers et body sans valeur supplémentaire.

### `3)` Rendre le debug distant corrélable

> Retrouver une requête précise sans dépendre d’un dump brut global.

1. Conserver systématiquement request ID, méthode, route, statut, durée et code d’erreur dans les logs standards.
2. Réutiliser le `X-Request-Id` déjà envoyé par Angular; l’ajouter à l’APIClient iOS et à son log d’erreur.
3. Documenter le runbook preview: activer le mode détaillé, redéployer, reproduire avec des données de test, filtrer par request ID, puis désactiver le flag.

### `4)` Réduire le log de recherche

> Garder la mesure opérationnelle, pas le contenu financier.

1. Retirer le texte recherché, les IDs de tags et l’identifiant utilisateur de l’événement info.
2. Conserver seulement l’opération, le nombre de résultats, la durée disponible et les années agrégées.
3. Tester avec des sentinelles représentant un marchand, une dette et un identifiant de tag.

### `5)` Borner Turnstile

> Réutiliser le timeout natif déjà employé par les autres appels sortants.

1. Passer `AbortSignal.timeout(5000)` au fetch Cloudflare.
2. Traiter le timeout comme une vérification échouée contrôlée.
3. Tester qu’un fetch bloqué libère le handler dans la borne choisie.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Avec le flag actif, `NODE_ENV=production` ou l’environnement Railway `production` produit uniquement les logs standards; une preview explicitement activée produit les détails. |
| 2 | Un payload preview ordinaire reste lisible, mais aucune sentinelle placée dans un secret imbriqué, header ou réponse n’apparaît; aucun log ne contient de commande cURL brute. |
| 3 | Une erreur Angular ou iOS fournit un request ID permettant de retrouver exactement la requête, son statut, sa durée et son erreur backend. |
| 4 | Les sentinelles de recherche et de tags sont absentes des logs, tandis que le compte de résultats reste observable. |
| 5 | Un Turnstile qui ne répond pas termine en échec contrôlé en environ cinq secondes au lieu de garder la requête ouverte. |
