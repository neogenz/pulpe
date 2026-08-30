---
status: pending
---

# Instruction: Fiabiliser PostHog et promouvoir le binaire TestFlight

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .github/
│   ├── scripts/
│   │   ├── ci-security.test.mjs                              ✏️ verrouille ordre, reprise et frontière non bloquante
│   │   └── resolve-ios-distribution-intent.mjs               ✅ réutilisé sans modification
│   └── workflows/ios-distribute.yml                          ✏️ promeut sans réupload et publie PostHog
├── landing/scripts/
│   ├── create-release.js                                    ✏️ implémente le contrat PostHog commun
│   └── create-release.test.js                               ✏️ vérifie identité, idempotence et erreurs
└── docs/
    ├── DEPLOYMENT.md                                        ✏️ documente la promotion internal vers release
    └── POSTHOG_RELEASES.md                                  ✏️ documente le contrat réel des releases
```

## Tasks to do

### `1)` Corriger le contrat PostHog aux deux frontières

> Le workflow checkout le SHA historique du binaire: aucun nouveau helper partagé n'y serait disponible.

1. Définir `project` comme nom stable d'application, `version` comme version de plateforme et `hash_id` comme SHA-512 du couple projet/version.
2. Mettre le SHA Git dans `metadata`; sur collision de hash, relire et accepter uniquement la même identité.
3. Utiliser les API Node natives côté landing et les outils natifs du runner côté iOS, sans dépendance.
4. Faire remonter un échec réel; laisser chaque appelant choisir explicitement le mode non bloquant.

### `2)` Promouvoir un upload interne exact

> Transformer le build TestFlight testé en preuve release sans nouveau binaire.

1. Pour un build App Store déjà `VALID`, router depuis `main` vers le résolveur existant avec le canal `internal` et la branche `main`.
2. Vérifier le run source, sa branche `main`, l'identité IPA et l'upload réussi; refuser tout écart.
3. Sauter archive/export/upload, produire la preuve `release`, puis appeler PostHog après cette preuve.
4. Préserver sans modification le chemin de release fraîche depuis `production` ou un tag annoté autorisé.

### `3)` Verrouiller le contrat

> Une dérive d'identité ou d'ordre doit échouer localement.

1. Étendre les tests PostHog, de provenance iOS et les gates statiques du workflow.
2. Exécuter les suites ciblées puis `pnpm quality`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Landing et iOS créent des releases distinctes et idempotentes conformes au contrat PostHog officiel; une erreur reste observable.                             |
| 2    | Le build 1.4.3 (12) peut acquérir une preuve `release` depuis son upload interne exact sans reconstruire ni réuploader; toute provenance voisine est refusée. |
| 3    | Les tests échouent si le payload, la provenance, l'ordre après preuve Apple ou la frontière non bloquante dérive.                                             |
