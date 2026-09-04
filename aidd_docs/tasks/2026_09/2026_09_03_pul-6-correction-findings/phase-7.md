# Phase 7 — Lever les findings tardifs de la PR

## Goal

Corriger les remarques publiées après la première validation complète, sans élargir le périmètre de PUL-6.

## Changes

- Contraindre les sélecteurs de mois Web aux bornes du contrat partagé, aligner les membres de template sur les conventions Angular et garder le spinner en ligne.
- Préserver le message de l'erreur initiale dans les logs de double échec backend.
- Aligner le port de génération atomique sur la plage réellement acceptée par le RPC.
- Préserver sur Android l'horizon complet des deux sélecteurs, masquer les compteurs de plage invalides et pluraliser séparément chaque compteur du résultat.
- Prouver que l'invalidation Android reste attendue avant le succès de la mutation.
- Rendre l'échec initial des modèles relançable sur iOS, masquer son compteur de plage invalide et verrouiller la pluralisation du catalogue Swift.
- Rejouer les tests ciblés, la qualité complète, la revue indépendante et la CI avant de résoudre les fils GitHub.

## Acceptance criteria

- [x] Les deux datepickers empêchent la navigation/sélection hors bornes partagées.
- [x] Le bouton de soumission aligne spinner et libellé dans un wrapper flex.
- [x] Les bindings Angular concernés sont `protected readonly`.
- [x] Les logs de double échec sérialisent l'erreur active dans `err` et le message de la cause initiale.
- [x] Le port atomique accepte explicitement `startMonth`, `startYear` et `count`.
- [x] Android conserve des horizons réversibles, masque les plages invalides et pluralise périodes, créations et skips indépendamment dans les quatre langues.
- [x] Le succès Android attend l'invalidation de cache, y compris lorsque celle-ci est différée.
- [x] iOS propose une relance après l'échec initial des modèles, masque le compteur invalide et résout le pluriel interpolé via le catalogue.
- [x] Tests ciblés, qualité, revue et CI sont verts; les fils GitHub sont résolus.
