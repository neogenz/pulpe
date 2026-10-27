# Journey report — PR #570 (épargne hors horizon d'objectif)

Entry URL: `http://localhost:4201` (worktree stack: backend `:3001`, frontend `:4201`, Supabase local partagé)
Date: 2026-08-02

## Steps

| # | Action | Expected | Actual | Result |
|---|--------|----------|--------|--------|
| 1 | Ouvrir `/` | Landing Pulpe, CTA « Essayer sans compte » | Landing rendue, CTA présent | pass |
| 2 | Cliquer « Essayer sans compte » | Entrée en mode démo, dashboard chargé | Bandeau « Mode Démo », hero Août 2'139 CHF, transactions + prévisions chargées | pass |
| 3 | Cliquer « Budgets » | Liste des 11 budgets 2026 | Liste rendue, Août marqué « Actuel » | pass |
| 4 | Cliquer « Objectifs » → « Nouvel objectif » | Dialog de création | Dialog ouvert (Nom, Montant cible, Montant de départ, Début, Échéance, toggle épargne mensuelle) | pass |
| 5 | Saisir Nom + Échéance **31.07.2026** (passée) | — | « Enregistrer » reste **disabled** : la validation `pastDate` de `savings-goal-form-dialog.ts` refuse une échéance antérieure à aujourd'hui | pass (prévention amont confirmée) |
| 6 | Corriger l'échéance à **30.09.2026** puis Enregistrer | Objectif créé et listé | « Voyage Japon — 30.09.2026 » listé | pass |
| 7 | Cliquer « Budgets » → ouvrir **Octobre 2026** (mois postérieur à l'échéance) | Page détail du budget d'octobre | **Déconnexion forcée** vers `/login` + toast « Une erreur est survenue — réessaie » | **fail** |
| 8 | Ajouter une prévision Épargne rattachée à « Voyage Japon » | Objectif grisé dans le picker ; si refus serveur, toast d'erreur **sans** vider la page | non atteint | bloqué par l'étape 7 |
| 9 | Vérifier que la page budget reste rendue après le refus | Page intacte, carte « Impossible de charger ton budget » absente | non atteint | bloqué par l'étape 7 |

## Blocage — étape 7

Reproduit 3 fois, ~2-3 min après chaque entrée en mode démo. Console :

```
[ERROR] [ApiClient] Reconnexion impossible — réessaie
[ERROR] [ApiClient] Authentication token missing
```

Cause tracée en base (`auth.refresh_tokens`, session `4302b7bf…`) :

```
session_id  | revoked | created_at            | has_parent
4302b7bf…   | t       | 18:41:04.842          | f
4302b7bf…   | t       | 18:41:09.333          | t
4302b7bf…   | t       | 18:41:09.379          | t
4302b7bf…   | t       | 18:41:09.453          | t   <- révoqué 18:41:34, sans successeur
```

Quatre rotations de refresh token en 5 secondes après le sign-in démo, puis révocation de toute la famille : un appel de refresh arrive sur un token déjà tourné, hors de la fenêtre `refresh_token_reuse_interval = 10`s, avec `enable_refresh_token_rotation = true`. Toute requête suivante retourne 401 et l'app déconnecte.

Hors périmètre de cette PR : aucun commit de la branche ne touche l'auth, l'`ApiClient` ou le client Supabase. Cette rafale de refresh existe indépendamment du correctif.

## Impact aval

Les étapes 8 et 9 — le scénario du bug lui-même — n'ont pas pu être observées dans le navigateur. Elles restent couvertes par les suites automatisées :

| Suite | Résultat |
|-------|----------|
| `frontend` budget-details (35 fichiers) | 457 tests pass |
| `frontend` savings-goals (15 fichiers) | 175 tests pass |
| `backend-nest` budget-line + savings-goal (36 fichiers) | 335 tests pass |
| CI PR #570 (unit, intégration, E2E mockés, iOS, quality, build) | tous verts |
