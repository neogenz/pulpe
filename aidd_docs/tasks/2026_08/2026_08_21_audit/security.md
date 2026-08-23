# Audit Android — Security & privacy

- Date : 2026-08-21
- Périmètre : auth/session, vault, stockage, transport, secrets, diagnostics et surface Expo
- Santé : **correcte, avec deux risques de cycle de vie/confidentialité**

## Findings

| Sev | Category          | Location                                                   | Issue                                                                                                                                                                                                                                                                                                                                                        | Suggested fix                                                                                                                                       | Effort |
| --- | ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 🟡  | Account isolation | `android/src/core/auth/session-store.ts:144`               | Le listener `SIGNED_OUT` lance le purge local en arrière-plan puis publie immédiatement l'état anonyme. Le `signOut()` normal exécute en parallèle un second purge. Une nouvelle connexion peut donc commencer pendant qu'un ancien purge efface encore cache, locale, vault et clés; le test unitaire promet l'ordre inverse mais ne monte pas le listener. | Sérialiser/dédupliquer un unique teardown et ne publier `unauthenticated` qu'après le purge; tester un `clearAllKeys` retardé via le vrai listener. | M      |
| 🟡  | Privacy           | `android/src/core/observability/diagnostics-consent.ts:21` | Une installation jamais interrogée est opt-in par défaut. En production, PostHog démarre alors avant toute visite des préférences et `analytics.ts:49` identifie l'utilisateur avec e-mail et prénom. C'est un risque de minimisation et de consentement, même si les événements financiers sont filtrés.                                                    | Choisir opt-in explicite avant le premier envoi, ou supprimer e-mail/prénom de l'identité et documenter clairement la base de traitement retenue.   | S      |

## Top actions

1. Faire du teardown de compte une transaction locale unique et attendue.
2. Décider explicitement la politique de consentement diagnostics et minimiser l'identité envoyée.

## Coverage

- Vérifiés : secrets usuels, URLs/HTTP, validation Zod aux frontières, SecureStore, clés vault, `allowBackup:false`, `FLAG_SECURE`, permissions de release et liens de récupération.
- Points sains : aucun secret privé trouvé; clés Supabase/PostHog présentes dans EAS sont publiques par conception; production HTTPS imposée; données financières exclues des propriétés analytics.
- Limites : pas de pentest dynamique, d'inspection d'un APK/AAB généré ni de validation RLS/backend dans ce pilier client.
