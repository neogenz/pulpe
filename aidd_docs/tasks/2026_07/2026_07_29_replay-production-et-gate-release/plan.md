---
objective: "Rendre le replay web exploitable en production sans exposer les données financières, supprimer les sentinelles nominatives devenues inutiles et intégrer la migration legacy au flux de release avant toute mise en production."
status: implemented
---

# Plan: Replay production et gate de release

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Réactiver le replay web en production derrière la configuration et l’opt-out existants, fermer les derniers trous de masquage, alléger le test de surface publique et rendre impossible l’oubli de la migration `scheduledDeletionAt`. |
| **Source** | Retours annotés du 29 juillet 2026 sur le rapport de durcissement de la branche preview. |

## Phases

| # | Phase | File |
| - | ----- | ---- |
| 1 | Autoriser le replay production avec le masquage existant | [`phase-1.md`](./phase-1.md) |
| 2 | Retirer les sentinelles nominatives sans affaiblir les contrôles structurels | [`phase-2.md`](./phase-2.md) |
| 3 | Intégrer la migration ponctuelle avant la release | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://posthog.com/docs/session-replay/privacy | Les champs de saisie sont masqués par défaut, le texte ordinaire ne l’est pas, et `ph-no-capture` remplace un élément sensible par un bloc dans le replay. |
| https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record | Le SDK permet de démarrer ou d’arrêter le replay dynamiquement; les règles d’enregistrement et d’échantillonnage peuvent rester pilotées par PostHog. |
| `frontend/projects/webapp/src/app/core/analytics/posthog.ts` | Le replay est déjà configurable, `maskAllInputs` est actif et l’opt-out arrête immédiatement l’enregistrement. Seule une condition interdit actuellement la production. |
| `.claude/rules/05-workflows-and-processes/posthog-privacy.md` | Le projet possède déjà un contrat unique de masquage avec `ph-no-capture`; aucune nouvelle convention n’est nécessaire. |
| `.claude/skills/release/SKILL.md` | Le skill calcule déjà `BASE_REF`, analyse le diff, demande une approbation avant publication et vérifie preview avant de promouvoir le même SHA vers main. |
| `docs/DEPLOYMENT.md` | Le runbook dry-run/maintenance/apply/dry-run existe déjà, mais il n’est pas encore imposé par `/release`. |

## Decisions

| Decision | Why |
| -------- | --- |
| Faire dépendre le replay de `PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED`, y compris en production, au lieu d’ajouter un nouveau toggle. | Le réglage « Données de diagnostic » et l’opt-out immédiat existent déjà; une seconde interface ou un second mécanisme créerait de la dette sans apporter de contrôle utile. |
| Conserver un seul projet PostHog et l’identité Supabase existante. | Le besoin est de relier les événements et le replay d’un même utilisateur pour le support; ni l’analytics identifié ni la séparation de persistence landing/app ne sont remis en cause. |
| Garder `maskAllInputs` et compléter seulement les éléments DOM sensibles oubliés avec `ph-no-capture`. | Le masquage global de tout le texte rendrait les replays beaucoup moins utiles; la convention sélective existe déjà et couvre la majorité de l’application. |
| Masquer aussi les copies accessibles et les overlays de tooltip contenant un libellé utilisateur. | Le texte invisible visuellement peut tout de même être enregistré; protéger seulement le montant affiché laisserait une fuite réelle dans le replay. |
| Supprimer les listes de noms, chemins personnels et anecdotes figées du test de surface publique, mais garder les contrôles génériques de sécurité et de qualité des skills. | Le nettoyage initial est terminé; ces sentinelles personnelles ont désormais un coût de maintenance supérieur à leur valeur, contrairement aux invariants structurels. |
| Déclencher la migration uniquement pour la première release dont le diff contient son changement de modèle. | Le diff depuis le dernier tag est déjà calculé par `/release`; il fournit un déclencheur ponctuel sans état, marker ou nouvel outil à maintenir. |
| Exécuter le dry-run avant la promotion en production; si `eligible > 0`, demander une approbation explicite puis orchestrer maintenance/apply/dry-run avant de poursuivre. | Il n’y a ainsi aucune action post-release à mémoriser. Une écriture Auth Admin et une interruption de service ne doivent toutefois jamais devenir silencieuses. |
| Ne modifier aucune interface web ou iOS. | Le toggle de diagnostic actuel suffit et les changements de masquage n’ont aucun impact visuel hors replay. |
