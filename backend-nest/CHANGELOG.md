# backend-nest

## 0.4.1

### Patch Changes

- Protection anti-spam ajoutée sur l'API backend. Un système de limitation de débit basé sur l'identifiant utilisateur a été implémenté pour prévenir les abus d'API. Chaque utilisateur authentifié est maintenant limité à 1000 requêtes par minute, ce qui est largement suffisant pour une utilisation normale tout en empêchant les attaques par spam de création de données.

## 0.4.0

### Minor Changes

- Ajout du mode démo avec utilisateurs éphémères et protection anti-bot

  Nouvelle fonctionnalité permettant d'explorer l'application sans créer de compte :
  - **Mode démo sans inscription** : Bouton "Essayer en mode démo" sur les pages de connexion et d'onboarding
  - **Utilisateurs éphémères** : Sessions automatiques de 24 heures avec données de démonstration réalistes
  - **Protection anti-spam** : Intégration de Cloudflare Turnstile (invisible pour les utilisateurs légitimes)
  - **Nettoyage automatique** : Suppression programmée des comptes de démonstration expirés toutes les 6 heures
  - **Données pré-remplies** : Templates de budget, budgets mensuels (6 mois passés + 6 mois futurs), et transactions d'exemple

  Cette fonctionnalité améliore l'expérience d'onboarding en permettant aux utilisateurs d'évaluer l'application immédiatement, sans friction.

### Patch Changes

- Updated dependencies
  - @pulpe/shared@0.3.0

## 0.3.0

### Minor Changes

- Nouvelle fonctionnalité : Propagation intelligente des modèles de budget

  Les modifications apportées à vos modèles de budget peuvent maintenant être propagées vers vos budgets futurs. Le système protège automatiquement vos lignes personnalisées pour ne mettre à jour que les éléments non modifiés. Cette amélioration facilite la gestion de vos prévisions sur plusieurs mois.
  - Dialogue de confirmation lors de la modification d'un modèle
  - Protection des lignes modifiées manuellement
  - Propagation uniquement vers les budgets futurs
  - Préservation de vos ajustements personnalisés

### Patch Changes

- Updated dependencies
  - @pulpe/shared@0.2.1

## 0.2.0

### Minor Changes

- # Automatic Living Allowance Rollover System

  Introduces automatic rollover of unused budget between months, enabling users to carry forward their "Available to Spend" balance instead of losing it at month-end.

  **New Features:**
  - **Automatic Rollover**: Unused Living Allowance automatically carries over to the next month
  - **Cumulative Balance View**: See total accumulated balance across months in budget tables
  - **Month Navigation**: Navigate between months to track rollover flow with dedicated navigation buttons
  - **Visual Distinction**: Rollover amounts are clearly highlighted in the budget interface

  **User Benefits:**
  - No more lost unused budget at month transitions
  - Better long-term financial planning with accumulated savings
  - Clear visibility into budget carryover between periods
  - Improved budget management workflow

  **Technical Improvements:**
  - Persistent cumulative rollover balance for O(1) performance
  - Enhanced error handling and data consistency
  - Robust database migrations for existing budgets
  - Comprehensive test coverage for edge cases

  This feature fundamentally improves how users manage their monthly budgets by preserving unused funds across time periods.

### Patch Changes

- Updated dependencies
  - @pulpe/shared@0.2.0
