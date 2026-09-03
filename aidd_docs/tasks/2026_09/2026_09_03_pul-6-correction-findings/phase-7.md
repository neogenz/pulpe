# Phase 7 — Lever les findings tardifs de la PR

## Goal

Corriger les remarques publiées après la première validation complète, sans élargir le périmètre de PUL-6.

## Changes

- Contraindre les sélecteurs de mois Web aux bornes du contrat partagé, aligner les membres de template sur les conventions Angular et garder le spinner en ligne.
- Préserver le message de l'erreur initiale dans les logs de double échec backend.
- Aligner le port de génération atomique sur la plage réellement acceptée par le RPC.
- Rejouer les tests ciblés, la qualité complète, la revue indépendante et la CI avant de résoudre les fils GitHub.

## Acceptance criteria

- [ ] Les deux datepickers empêchent la navigation/sélection hors bornes partagées.
- [ ] Le bouton de soumission aligne spinner et libellé dans un wrapper flex.
- [ ] Les bindings Angular concernés sont `protected readonly`.
- [ ] Les logs de double échec sérialisent l'erreur active dans `err` et le message de la cause initiale.
- [ ] Le port atomique accepte explicitement `startMonth`, `startYear` et `count`.
- [ ] Tests ciblés, qualité, revue et CI sont verts; les fils GitHub sont résolus.
