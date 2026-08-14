---
objective: "La branche preview peut être publiée comme dépôt open source sans exposer de chemin direct de reprise de compte, de suppression destructive non fiable, de données sensibles dans la télémétrie ni d’artefacts internes exploitables contre la sécurité ou la réputation du projet."
status: implemented
---

# Plan: Durcir preview avant publication open source

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les risques dont l’impact réel justifie le coût, conserver le diagnostic identifié utile au support, puis assainir ce qu’un audit hostile du dépôt public pourrait exploiter ou sortir de son contexte, sans casser les parcours locaux ni les workflows IA utiles. |
| **Source** | Audit statique complet de `preview@3f20c74cc00bef6e23c0e37571373ddbcfc7f42a`, revalidé sur l’arbre courant `preview@1fc6d6bf414c6868c9f87bc8e9f408fb2d1266ec`, complété par une revue adversariale des fichiers suivis, de l’historique public et des contraintes locales exprimées par l’utilisateur. |

## Phases

| # | Priorité | Phase | Valeur | File |
| --- | --- | --- | --- | --- |
| 1 | P0 | Protéger la récupération iOS | Ferme un callback de reprise de compte interceptable par une autre app. | [`phase-1.md`](./phase-1.md) |
| 2 | P0 | Fiabiliser la suppression de compte | Retire une donnée client d’une décision destructive et exige la vraie clé de coffre. | [`phase-2.md`](./phase-2.md) |
| 3 | P1 | Éliminer les fuites opérationnelles | Conserve un debug distant assaini en preview, le rend inactivable en production et borne un appel externe bloquant. | [`phase-3.md`](./phase-3.md) |
| 4 | P1 | Rendre la déconnexion iOS réelle | Aligne « Déconnexion » avec la révocation attendue de la session. | [`phase-4.md`](./phase-4.md) |
| 5 | P1 | Durcir la télémétrie identifiée | Conserve la jointure Supabase/PostHog utile au support, avec opt-out natif et sans replay production. | [`phase-5.md`](./phase-5.md) |
| 6 | P1 | Séparer la CI de la production | Empêche du code de PR et une archive non vérifiée d’atteindre les secrets production. | [`phase-6.md`](./phase-6.md) |
| 7 | P2 | Assainir la surface publique du dépôt | Retire les permissions clonables, données de travail personnelles, claims inexacts et archives internes sans valeur pour les contributeurs. | [`phase-7.md`](./phase-7.md) |

## Resources

| Source | Verified |
| --- | --- |
| https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content/ | Un universal link repose sur une association bidirectionnelle entre l’app signée et un domaine possédé. |
| https://developer.apple.com/documentation/technotes/tn3155-debugging-universal-links | L’entitlement `applinks:` et le fichier AASA doivent viser exactement le même domaine. |
| https://supabase.com/docs/guides/auth/redirect-urls | Les redirects de production doivent être exacts et les previews Vercel peuvent être bornées au slug de l’équipe propriétaire. |
| https://supabase.com/docs/guides/auth/users | `user_metadata` est modifiable par l’utilisateur et ne doit pas piloter une décision de sécurité. |
| https://posthog.com/docs/privacy/data-collection | PostHog permet le mode cookieless, l’opt-out et l’arrêt complet des captures. |
| https://posthog.com/docs/libraries/js/persistence | La persistance PostHog peut rester gérée par le SDK; aucun réglage de compte côté Supabase n’est nécessaire pour un opt-out local. |
| https://posthog.com/docs/references/posthog-ios | Le SDK iOS expose les primitives natives d’opt-in et d’opt-out. |
| https://posthog.com/docs/session-replay/privacy | Le texte ordinaire n’est pas masqué par défaut et `ph-no-capture` exclut une zone sensible. |
| https://docs.github.com/en/actions/reference/security/secure-use | Du code de PR ne doit pas être exécuté dans un contexte qui reçoit des secrets privilégiés. |

## Decisions

| Decision | Why |
| --- | --- |
| Réserver la récupération iOS à `https://app.pulpe.app/reset-password`; conserver `pulpe://` uniquement pour les liens non authentifiants. | Le domaine de l’app et l’app iOS se valident mutuellement, contrairement à un schéma privé enregistrable par une autre app. |
| Déplacer `scheduledDeletionAt` dans `app_metadata` et vérifier la vraie clé de coffre avant programmation. | Réutilise deux primitives existantes contrôlées par le serveur, sans ajouter de table ni de protocole de challenge. |
| Conserver un mode HTTP détaillé en preview, mais rendre la redaction non désactivable et forcer le mode standard dès que `NODE_ENV` ou Railway désigne la production. | Les payloads assainis et le request ID sont utiles pour reproduire à distance; les credentials, clés de coffre et tokens bruts ne le sont pas. |
| Conserver l’identification PostHog par UUID Supabase, avec email et prénom utiles au support; ajouter un opt-out local par plateforme et interdire le session replay en production. | Réutilise les contrôles natifs des SDK, préserve la chronologie d’incident et évite une migration Supabase, une CMP ou un nouveau sous-système de préférences. |
| Exécuter toute opération liée aux secrets de production uniquement depuis un commit déjà intégré à `main`. | Une approbation d’environnement ne rend pas fiable le code provenant d’une PR. |
| Conserver explicitement les témoignages et prénoms publiés dans la landing; nettoyer seulement les fixtures personnelles et artefacts internes. | Ces références sont du contenu public volontaire, pas une fuite à corriger. |
| Garder les plans et leurs statuts dans `aidd_docs/tasks/` hors du suivi Git; committer localement seulement les changements produit de chaque phase, sans push, force-push ni réécriture d’historique. | Évite de republier le journal de travail interne et rend l’exécution réversible tant que la branche n’a pas été relue. |

## Explicitly deferred

| Item | Why not now | Revisit when |
| --- | --- | --- |
| Remplacer le PIN à 4 chiffres par une nouvelle dérivation cryptographique. | L’exploitation suppose déjà la base chiffrée et le secret maître; la migration serait large pour un gain immédiat faible. | Le modèle de menace inclut une compromission simultanée base + secret maître, ou un audit cryptographique dédié l’exige. |
| Migrer l’état transitoire d’onboarding iOS hors `UserDefaults`. | Données locales de faible impact dans le sandbox de l’app; aucun chemin de reprise de compte n’en dépend. | Une exigence de protection des backups/appareils compromis est adoptée. |
| Synchroniser le choix analytics entre appareils ou construire une CMP complète. | L’opt-out persistant fourni par chaque SDK couvre le besoin immédiat sans table, route backend ni refonte de consentement. | Le choix doit devenir global au compte, ou une revue juridique dédiée impose un autre mécanisme. |
| Autoriser le session replay en production. | La chronologie d’événements identifiée couvre d’abord le support avec une surface de collecte moindre. | Des incidents réels restent impossibles à diagnostiquer sans replay et un cadre de masquage dédié est validé. |
| Réécrire l’historique Git. | Le dépôt est déjà public, une réécriture ne garantit pas l’effacement des clones et le périmètre actuel doit rester local, réversible et non destructif. | Un vrai secret ou une donnée personnelle réglementée est confirmé, révoqué en premier, puis traité dans une opération séparée avec sauvegarde et approbation explicite. |
| Traiter les identifiants et clés explicitement publics comme des secrets. | Hors périmètre demandé et sans gain si leur modèle d’usage autorise l’exposition. | Une clé obtient un privilège serveur ou une facturation non bornée. |
