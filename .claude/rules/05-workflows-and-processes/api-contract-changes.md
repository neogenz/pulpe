---
description: Compatibility checklist for API contract changes — Zod request/response schemas, DTOs, endpoint signatures
paths:
  - "shared/schemas.ts"
  - "shared/**/*.ts"
  - "backend-nest/src/**/*.controller.ts"
  - "backend-nest/src/**/dto/**/*.ts"
---

# API Contract Changes

## Pre-flight: classify the change

Avant de toucher un schema `*CreateSchema` / `*UpdateSchema` / `*ResponseSchema` ou un endpoint, classifier:

| Type de changement | Cassant pour clients déployés ? |
|---|---|
| Ajouter champ optionnel (request) | Non |
| Ajouter champ (response) | Non — clients ignorent |
| Renommer champ | **OUI** — break |
| Retirer champ (request) | Risque — vieux clients envoient encore |
| Retirer champ (response) | **OUI** — break |
| `z.object` → `z.strictObject` | **OUI** — extra fields → 400 |
| Tightening validator (max plus petit, regex stricte, `.min()`) | **OUI** — vieux input rejeté |
| Loosening validator (max plus grand, optional → required removed) | Non |
| Required → optional | Non |
| Optional → required | **OUI** — break |
| Changer type (`string` → `number`) | **OUI** — break |
| Changer URL/verbe endpoint | **OUI** — break |
| Changer status code | Risque — clients qui matchent par status |

## Mandatory checklist for breaking changes

Pour chaque changement marqué **OUI** ou **Risque**:

### 1. Inventaire des clients

Vérifier l'impact sur:
- **Webapp prod** (Angular) — `frontend/projects/webapp/src/app/core/**/api/*.ts` + form schemas
- **iOS App Store actuel** — `ios/Pulpe/Domain/Models/*.swift` (Encodable structs)
- **iOS TestFlight builds en circulation** — vérifier si DTOs alignés
- **Intégrations externes** — N/A actuellement, mais documenter si ajouté

### 2. Vérifier alignement DTO ↔ schema

```bash
# iOS DTOs
grep -rn "struct.*: Encodable" ios/Pulpe/Domain/Models --include="*.swift"

# Webapp form/wire schemas
grep -rn "<schemaName>" frontend/projects/webapp/src --include="*.ts"
```

Pour chaque client: champ par champ, le DTO/struct doit matcher le nouveau schema.

### 3. Choisir une stratégie

**Option A — Backward compat** (préféré si possible):
- Ajouter le nouveau champ optional/nullable à côté de l'ancien
- Supporter les 2 chemins lecture
- Marquer l'ancien `@deprecated` dans JSDoc
- Retirer après ≥1 release majeure iOS App Store

**Option B — Bump endpoint version**:
- Nouveau endpoint sous `/v2/...`
- Garder `/v1/...` redirect vers ancienne logique ou alias schema
- Sunset documenté

**Option C — Synchronized release** (acceptable si webapp-only ou si iOS pas encore en prod):
- Confirmer que tous les clients déployés ont DTOs alignés au moment du merge
- Documenter la fenêtre de risque (ex: "iOS TestFlight builds antérieurs au YYYY-MM-DD cassent")

### 4. Post-merge monitoring

Pour `Risque` ou `OUI` shippé:
- Watch backend logs / Sentry pendant ≥7 jours pour `ZodValidationException`, `unrecognized_keys`, status 400 anormaux
- Set up un agent `/schedule` pour audit dans 7 jours si pas couvert par alerting

## Anti-patterns observés

| Don't | Do |
|---|---|
| Bump `z.object` → `z.strictObject` sans audit clients | Vérifier DTOs iOS + intégrations 1:1 d'abord |
| Retirer champ optional "puisque personne l'utilise" | Grep frontend + iOS + backend, vérifier vraie absence |
| Affirmer "déjà en prod, pas de risque" sans `git branch --contains <sha>` | Vérifier sur quelle branche le commit vit avant |
| Ajouter validator strict sans tester payloads existants | Logger payloads prod un cycle, puis bump |

## Strict mode (`z.strictObject`)

Tous les `*CreateSchema` / `*UpdateSchema` / `*BulkUpdateSchema` dans `shared/schemas.ts` sont strict. Read schemas (`*Schema`) restent loose (additive DB).

Webapp parse client-side avec `requestSchema` dans `ApiClient.post$/patch$/put$` — extras → `ZodError` local. iOS structs `Encodable` auto-synth omettent `nil` → pas de fuite de champ.

**Quand ajouter un nouveau strict schema:**
1. Vérifier DTO iOS + form webapp 1:1
2. Vérifier qu'aucune mutation côté serveur n'injecte un champ extra avant validation
3. Tester e2e webapp + iOS local avant merge

## Reference

- Schemas source: `shared/schemas.ts`
- Backend pipe: `backend-nest/src/app.module.ts` (`ZodValidationPipe`)
- Frontend parser: `frontend/projects/webapp/src/app/core/api/api-client.ts`
- iOS DTOs: `ios/Pulpe/Domain/Models/*.swift`
