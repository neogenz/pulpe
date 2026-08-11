---
objective: "Les six défauts relevés par la QA manuelle sur preview sont corrigés à la racine, couverts par un test de régression chacun, et la branche est prête à être promue."
status: reviewed
---

# Plan: Correctifs issus de la QA manuelle preview

## Overview

| Field      | Value                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre PUL-329 utilisable de bout en bout et aligner l'affichage monétaire sur la règle du projet.               |
| **Source** | Session de QA manuelle du 2026-08-04 sur `https://pulpe-frontend-git-preview-…vercel.app`, défauts revérifiés sur `fef5077`. |

## Phases

| #   | Phase                                              | File                         |
| --- | -------------------------------------------------- | ---------------------------- |
| 1   | Origine d'épargne rendue au détail d'un budget      | [`phase-1.md`](./phase-1.md) |
| 2   | Le reliquat cesse de piéger le retrait               | [`phase-2.md`](./phase-2.md) |
| 3   | Un refus serveur ne coûte plus la saisie             | [`phase-3.md`](./phase-3.md) |
| 4   | Ce que l'écran raconte redevient vrai                | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision                                                                                                                           | Why                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Le solde retirable s'affiche en `'1.0-2'`, pas en `'1.0-0'`, sur le sélecteur d'objectif — web et iOS.                              | C'est un plafond que l'utilisateur doit pouvoir ressaisir à l'unité près. Arrondi à l'entier, l'écran promet « → 0 CHF » puis laisse un reliquat invisible et irretirable. La règle monétaire prévoit déjà `'1.0-2'` pour un écho de saisie ; c'en est un.                    |
| Le filtre des objectifs retirables passe de `> 0` à `> WITHDRAWAL_BALANCE_TOLERANCE`.                                              | `> 0` laisse passer un solde flottant résiduel (`3e-14`) qu'aucun client ne peut retirer : la garde côté client comme côté serveur refuse tout montant significatif. C'est le seul consommateur de la bande de tolérance qui n'utilisait pas la constante partagée.           |
| Le dialogue d'édition d'une transaction attend la réponse serveur avant de se fermer, via la couche `BudgetDetailsDialogService`.   | Les deux points d'entrée (liste et lien profond `?transactionId=`) passent par ce service. Corriger le service couvre les deux ; corriger chaque appelant en dupliquerait la garde et laisserait le prochain appelant sans protection.                                        |
