---
objective: "Tous les findings critiques et warnings de la revue sont fermés sans perdre le debug preview, l’analytics identifié de support, Face ID, la synchronisation automatique des worktrees ni la qualité des skills produit."
status: implemented
---

# Plan: Stabiliser le durcissement de preview

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Corriger les failles de coffre, de télémétrie, d’auth iOS et de workflow à leur frontière commune, avec des tests de non-régression et des gates de déploiement explicites. |
| **Source** | `aidd_docs/tasks/2026_07/2026_07_28_stabiliser-durcissement-preview/review.md` et contraintes données dans cette conversation. |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Rendre le rekey et le bootstrap exhaustifs | [`phase-1.md`](./phase-1.md) |
| 2 | Exiger une preuve de coffre fraîche pour chaque mutation | [`phase-2.md`](./phase-2.md) |
| 3 | Assainir les erreurs et verrouiller le runtime production | [`phase-3.md`](./phase-3.md) |
| 4 | Isoler les identités landing et app sans perdre les CTA | [`phase-4.md`](./phase-4.md) |
| 5 | Restaurer complètement l’analytics après opt-in | [`phase-5.md`](./phase-5.md) |
| 6 | Simplifier Face ID autour du vrai flux actif | [`phase-6.md`](./phase-6.md) |
| 7 | Sécuriser les workflows locaux et assainir les skills sans les appauvrir | [`phase-7.md`](./phase-7.md) |
| 8 | Verrouiller le rollout production et les contrats documentés | [`phase-8.md`](./phase-8.md) |
| 9 | Fermer les fuites résiduelles des logs détaillés | [`phase-9.md`](./phase-9.md) |
| 10 | Fermer les findings finaux et revalider la branche | [`phase-10.md`](./phase-10.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://supabase.com/docs/reference/javascript/using-modifiers-range | La pagination Supabase est inclusive, indexée à zéro et doit avoir un ordre stable. |
| https://posthog.com/docs/libraries/js/config | Le cookie cross-subdomain est actif par défaut; `before_send`, la persistence et le replay sont configurables explicitement. |
| https://posthog.com/docs/privacy/data-collection | L’opt-out arrête captures manuelles, autocapture et replay; son choix est persisté par le SDK. |
| https://posthog.com/docs/session-replay/installation/ios | SwiftUI exige `screenshotMode`; les screenshots peuvent contenir des données sensibles et la télémétrie réseau est active par défaut. |
| https://code.claude.com/docs/en/hooks | Les hooks utilisateur dans `~/.claude/settings.json` sont locaux; les hooks projet dans `.claude/settings.json` sont partageables et contrôlés par la branche. |
| https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid | L’API Admin permet de relire l’utilisateur courant juste avant une migration de metadata. |
| https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid | `updateUserById` écrit directement les metadata mais ne fournit aucun compare-and-swap; la garantie contre une écriture concurrente doit venir d’une fenêtre de maintenance. |

## Decisions

| Decision | Why |
| -------- | --- |
| Garder les lectures financières tolérantes, mais valider le canari une fois par requête pour toute mutation authentifiée. | Préserve l’UX de lecture existante tout en empêchant écritures et suppressions avec une DEK arbitraire ou stale, sans multiplier les lectures DB par champ chiffré. |
| Charger exhaustivement les données avant l’unique RPC atomique de rekey. | Découper la RPC permettrait de changer `key_check` après un état partiel; pagination et chunking des lectures conservent l’atomicité actuelle. |
| Conserver l’analytics identifié par UUID Supabase, email et prénom, activé par défaut avec opt-out immédiat. | C’est le besoin de support explicite; les corrections portent sur les contenus envoyés, l’isolation landing/app et la restauration après opt-in, pas sur le modèle de consentement. |
| Garder le replay web configurable uniquement hors production et désactiver explicitement replay et télémétrie réseau sur iOS. | Le replay SwiftUI utile exige des screenshots susceptibles de capturer l’interface financière; son activation mérite un audit dédié, pas un correctif opportuniste. |
| Réconcilier un bootstrap web déjà commité côté serveur au lieu de recommencer aveuglément. | Une réponse perdue ne doit ni invalider le PIN correct ni enfermer l’utilisateur dans une boucle `RECOVERY_KEY_ALREADY_EXISTS`; les primitives `validate-key` et `regenerate-recovery` existent déjà. |
| Faire gagner la production dès que `NODE_ENV` ou `RAILWAY_ENVIRONMENT_NAME` vaut `production`. | Un seul gate partagé évite qu’une configuration Railway contradictoire coupe les logs détaillés mais laisse Swagger, DebugModule, CORS de développement ou le bypass d’environnement Turnstile. |
| Déplacer seulement l’exécution automatique du sync dans une configuration et un script locaux de confiance; conserver `sync-env.sh` pour l’usage manuel. | Le workflow reste automatique sur la machine du développeur sans donner à une branche non revue un exécutable qui lit les `.env`. |
| Retirer uniquement les formulations personnelles, subjectives et les métriques figées des skills produit. | Les méthodes, références, contraintes UX, template, barème et intégration Linear restent intacts. |
| Migrer `scheduledDeletionAt` sous maintenance, avec dry-run puis relecture fraîche de chaque candidate avant écriture. | L’API Admin ne fournit pas de compare-and-swap sur `app_metadata`; la maintenance ferme la course résiduelle tandis que la relecture évite d’écraser une metadata devenue propriétaire avant l’update. Aucun RPC sur `auth.users` ni nouveau flag prétendant vérifier l’état distant n’est ajouté. |
| Ne modifier aucune interface utilisateur. | Tous les findings se ferment dans le comportement, les tests, la configuration locale et la documentation; aucun nouveau toggle ni wireframe n’est justifié. |
