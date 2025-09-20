# pulpe-frontend

## 2025.11.1

### Patch Changes

- ### Nouvelles fonctionnalités
  - **Analyse et suivi des erreurs**: Intégration de PostHog pour le suivi automatique des erreurs et l'analyse d'utilisation avec protection des données sensibles
  - **Pages légales**: Ajout des pages Conditions d'utilisation et Politique de confidentialité pour la conformité RGPD
  - **Suivi d'utilisation des modèles**: Amélioration de la gestion des modèles de budget avec un meilleur suivi d'utilisation et retour utilisateur

  ### Améliorations
  - **Gestion de configuration**: Configuration d'environnement simplifiée pour une meilleure séparation entre développement, tests et production
  - **Gestion d'état**: Refactorisation de la gestion d'état de la liste des budgets avec BudgetListStore pour plus de clarté et performance

## 2025.11.0

### Minor Changes

- Vue calendrier annuel pour la gestion des budgets
  - Visualisation complète de l'année en une seule vue grille responsive
  - Navigation intuitive entre les années avec système d'onglets
  - Indicateurs visuels du statut financier de chaque mois
  - Création de budget simplifiée directement depuis les mois vides
  - Amélioration de l'expérience utilisateur avec pré-sélection contextuelle

  Cette fonctionnalité transforme la gestion budgétaire en offrant une vision d'ensemble de l'année, facilitant la planification financière à long terme.

## 2025.10.0

### Minor Changes

- Ajout de la gestion multi-année dans la liste des budgets
  - Navigation par onglets pour visualiser les budgets par année
  - Sélection automatique de l'année lors de la création d'un budget
  - Amélioration de l'organisation et de l'affichage des données budgétaires

  Cette fonctionnalité permet aux utilisateurs de naviguer facilement entre les années et de mieux organiser leur planification budgétaire sur le long terme.

## 2025.9.1

### Patch Changes

- Corrige le rechargement de page lors des modifications du budget. Les prévisions et transactions sont maintenant mises à jour instantanément sans interruption de l'expérience utilisateur grâce aux optimistic updates.

## 2025.9.0

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
