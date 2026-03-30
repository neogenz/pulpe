# PostHog Release Management

Architecture de tracking multi-plateforme pour le monorepo Pulpe — sourcemaps, releases, annotations, source linking.

**Issue** : [PUL-21](https://linear.app/pulpe/issue/PUL-21/gerer-les-releases-posthog)
**Commit** : `94a530cf`

---

## Architecture

### Projet PostHog

Toutes les apps utilisent le **même projet PostHog** : **Pulpe Webapp** (ID `87621`).

| App | Domaine | Plateforme (super property) | Release format |
|-----|---------|---------------------------|----------------|
| Angular Webapp | app.pulpe.app | `web` | `pulpe-webapp` vX.Y.Z |
| Landing (Next.js) | pulpe.app | `landing` | `landing-X.Y.Z` |
| iOS (SwiftUI) | App Store | `ios` | `ios-X.Y.Z+BUILD` |
| Backend (NestJS) | api.pulpe.app | — | Non concerné |

Les events se distinguent via la super property `platform`. Les releases se distinguent par leur préfixe de nom.

> **Note** : Le projet PostHog "Pulpe Landing" (ID 75556) est un ancien projet de collecte d'emails, plus utilisé.

### Intégrations actives

- **GitHub** : Orga `neogenz`, repo `pulpe` autorisé → source linking sur les stack traces
- **Linear** : Workspace `pulpe` connecté → lien bidirectionnel issues/erreurs
- **Reverse proxy** : Vercel rewrites `/ph/*` → `eu.i.posthog.com` (contourne les ad blockers)

---

## Webapp — Sourcemaps + Source Linking

**Fichier** : `frontend/scripts/upload-sourcemaps.js`
**Déclenché par** : Build Vercel à chaque deploy

### Flux

```
Push main → CI verte → Vercel deploy → Build Angular →
  1. posthog-cli sourcemap inject --directory ./dist/webapp/browser
  2. posthog-cli sourcemap upload --directory ./dist/webapp/browser \
       --release-name pulpe-webapp \
       --release-version 0.30.0
  3. CI job posthog-annotate → annotation sur projet 87621
```

### Fonctionnement

Le PostHog CLI gère la création de release automatiquement lors de l'upload des sourcemaps. Les flags `--release-name` et `--release-version` identifient la release, et le CLI auto-détecte les infos Git (repo, commit SHA) pour activer le source linking GitHub.

Chaque frame de stack trace dans PostHog Error Tracking devient cliquable vers le fichier exact dans GitHub au bon commit.

### Variables d'environnement requises (Vercel — projet Webapp)

| Variable | Description |
|----------|-------------|
| `POSTHOG_PERSONAL_API_KEY` | Clé API personnelle PostHog (pas la clé projet) |
| `POSTHOG_CLI_ENV_ID` | ID du projet PostHog (87621) |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` (optionnel, défaut EU) |

---

## Landing — Création de release

**Fichier** : `landing/scripts/create-release.js`
**Déclenché par** : Build Vercel à chaque deploy (`buildCommand` dans `landing/vercel.json`)

### Flux

```
Push main → CI verte → Vercel deploy → Build Next.js →
  1. node scripts/create-release.js → Release "landing-X.Y.Z" créée via API REST (même projet 87621)
  2. CI job posthog-annotate → annotation sur projet 87621
```

### Fonctionnement

La landing utilise `output: 'export'` (site statique) — pas de sourcemaps. Le script crée une release PostHog via l'API REST pour le tracking de version. Non-bloquant : si les credentials manquent, le script skip silencieusement.

### Variables d'environnement requises (Vercel — projet Landing)

| Variable | Description |
|----------|-------------|
| `POSTHOG_PERSONAL_API_KEY` | Clé API personnelle PostHog |
| `POSTHOG_CLI_ENV_ID` | ID du projet PostHog (`87621`, même que webapp) |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` (optionnel, défaut EU) |

---

## iOS — Release + Annotation via CI

**Fichier** : `.github/workflows/ios.yml`
**Déclenché par** : Push sur `main` avec changements dans `ios/**`

### Flux

```
Push main (paths: ios/**) → iOS CI build →
  1. Extraction MARKETING_VERSION + CURRENT_PROJECT_VERSION depuis project.yml
  2. Release PostHog "ios-X.Y.Z+BUILD" via API REST
  3. Annotation PostHog "iOS vX.Y.Z"
```

### Fonctionnement

L'iOS a son propre cycle de release (App Store) avec un versioning indépendant. Pas de sourcemaps (Swift natif), mais les releases permettent le filtrage des erreurs par version iOS dans le même projet PostHog que le webapp (87621).

Le format de version `ios-X.Y.Z+BUILD` distingue les releases iOS des releases webapp dans PostHog.

### Pas encore implémenté : dSYM upload

PostHog supporte l'upload de dSYMs via `posthog-cli` pour la symbolication des crash reports natifs. À intégrer dans le workflow de release App Store (archive build).

---

## CI — Annotations automatiques

**Fichier** : `.github/workflows/ci.yml`
**Job** : `posthog-annotate`
**Condition** : `push main` + CI success

### Flux

```
CI verte sur main →
  1. Lecture de la version webapp (frontend/package.json)
  2. Annotation "v0.30.0 (abc1234)" sur projet 87621
```

### Fonctionnement

Les annotations créent des markers verticaux sur tous les graphiques PostHog. Quand un spike d'erreurs ou un changement de métriques apparaît, la corrélation avec un deploy est immédiate.

---

## Configuration requise

### Secrets GitHub Actions

> Repository Settings → Secrets and variables → Actions → New repository secret

| Secret | Valeur | Utilisé par |
|--------|--------|------------|
| `POSTHOG_PERSONAL_API_KEY` | Clé API personnelle PostHog | CI annotations, iOS release |
| `POSTHOG_WEBAPP_PROJECT_ID` | `87621` | CI annotations + iOS releases |

### Variables Vercel — projet Webapp (déjà configurées)

| Variable | Valeur |
|----------|--------|
| `POSTHOG_PERSONAL_API_KEY` | Clé API personnelle |
| `POSTHOG_CLI_ENV_ID` | `87621` |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` |

### Variables Vercel — projet Landing

> Vercel Dashboard → Projet Landing → Settings → Environment Variables

| Variable | Valeur |
|----------|--------|
| `POSTHOG_PERSONAL_API_KEY` | Même clé que GitHub |
| `POSTHOG_CLI_ENV_ID` | `87621` (même projet que webapp) |

---

## Ce que ça débloque

| Feature | Description |
|---------|-------------|
| **Source linking** | Chaque frame de stack trace → lien cliquable vers le fichier exact dans GitHub au bon commit |
| **Annotations** | Markers visuels sur tous les graphiques PostHog → corrélation deploy/métriques |
| **Releases** | Filtrage des erreurs par version, tracking des régressions |
| **Multi-plateforme** | iOS + Web + Landing avec releases indépendantes dans le même écosystème |
| **Status pending_release** | Marquer un bug "résolu au prochain deploy" → détection auto de régression si l'erreur revient |

---

## Future work

| Sujet | Description | Priorité |
|-------|-------------|----------|
| dSYM upload iOS | Symbolication des crash reports natifs via `posthog-cli` | Medium |
| Feature flags | 0 flags configurés, SDK prêt web + iOS. Gradual rollouts, kill switches | Medium |
| Workflow pending_release | Marquer les bugs résolus, vérifier au prochain deploy | Low |
| Tri des issues | 281 issues actives dans Error Tracking à trier | Low |
