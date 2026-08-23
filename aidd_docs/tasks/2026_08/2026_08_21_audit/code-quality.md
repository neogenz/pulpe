# Audit Android — Code quality

- Date : 2026-08-21
- Périmètre : `android/src`, configuration TypeScript/ESLint/Prettier
- Santé : **correcte, avec trois points de dette concentrés**

## Findings

| Sev | Category       | Location                                                  | Issue                                                                                                                                                                                                                                                                                                          | Suggested fix                                                                                                                                                                   | Effort |
| --- | -------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Error handling | `android/src/core/auth/session-store.ts:140`              | La restauration initiale appelle `getSession().then(...)` sans `catch`. Une erreur SecureStore laisse `status="loading"`; `_layout.tsx:86` garde alors le splash indéfiniment, sans erreur ni retry.                                                                                                           | Terminer explicitement dans un état stable en cas de rejet, exposer un retry et couvrir le rejet du stockage sécurisé.                                                          | S      |
| 🟡  | Observabilité  | `android/src/core/api/api-client.ts:233`                  | Le client génère `X-Request-Id`, mais ne conserve ni l'ID ni celui renvoyé par le serveur dans `ApiError`. Les erreurs gérées (`vault-store.ts:98`, `system-store.ts:87`) ne sont pas capturées par l'autocapture limitée aux rejets non gérés : un incident mobile ne peut pas être corrélé aux logs backend. | Porter `requestId` sur `ApiError` et ajouter une capture d'exception centralisée avec seulement `status`, `code` et `request_id`, sous consentement diagnostics.                | M      |
| 🟡  | Maintenabilité | `android/src/app/(main)/budget/[id]/line/[lineId].tsx:69` | Cette route de 595 lignes orchestre quatre queries, plusieurs mutations, dix états locaux et l'ensemble des menus/dialogues/sheets. La cohérence des transitions et erreurs dépend désormais d'un seul composant très large, sans test comportemental du composant.                                            | Extraire uniquement la coordination des actions/overlays dans un hook ou composant voisin; garder la route comme orchestrateur et ajouter un test des transitions destructives. | M      |

## Top actions

1. Rendre l'initialisation de session totale : succès, absence de session et erreur récupérable.
2. Faire respecter le contrat `request_id` Android → backend → PostHog.
3. Réduire le contrôleur de détail de prévision à ses responsabilités de route.

## Coverage

- Scannés : 332 fichiers TS/TSX (103 specs incluses), 36 690 lignes; recherche de `TODO/FIXME`, `any`, suppressions TypeScript/ESLint et logs console.
- Vérifiés : type-check, ESLint et Prettier passent; aucun `TODO/FIXME`, `any`, `@ts-ignore` ou log console de production trouvé.
- Limite : analyse statique; aucune injection de panne SecureStore sur appareil.
