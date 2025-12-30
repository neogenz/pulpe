# pulpe-frontend

## 2025.16.0

### Minor Changes

- ## Nouvelles fonctionnalités
  - **Allocation de transactions aux prévisions** : Possibilité d'associer des transactions réelles à des lignes de prévision spécifiques pour un meilleur suivi budgétaire
  - **Indicateur de rechargement** : Un indicateur visuel s'affiche lors du rechargement des données du budget, améliorant le feedback utilisateur
  - **Réinitialisation depuis le template** : Les lignes budgétaires détachées de leur template peuvent maintenant être réinitialisées pour retrouver les valeurs du template d'origine
  - **Dates de création des transactions** : Les transactions affichent désormais leur date de création dans la vue du mois en cours
  - **Vocabulaire fréquence amélioré** : La colonne fréquence utilise maintenant un vocabulaire plus clair (Récurrent/Prévu)
  - **Mise à niveau Angular 21** : Migration vers Angular 21 et Material 21 pour de meilleures performances et fonctionnalités

  ## Corrections
  - Correction du fil d'Ariane et nettoyage des effects Angular
  - Amélioration de l'affichage mobile et correction du défilement
  - Compatibilité améliorée avec Safari iOS pour la protection anti-bot
  - Optimisation de la taille du bundle et correction des warnings ESLint

## 2025.15.0

### Minor Changes

- Ajout de la visite guidée interactive pour les nouveaux utilisateurs
  - Guide pas-à-pas à travers les principales fonctionnalités de l'application
  - Présentation de la page du mois en cours, de la liste des budgets, des détails de budget et des templates
  - Sauvegarde de la progression pour ne pas répéter les étapes déjà vues

### Patch Changes

- Correction de l'affichage mobile et du défilement
  - Amélioration de la gestion du viewport sur mobile
  - Correction du défilement indésirable du body sur les appareils mobiles

## 2025.14.0

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

## 2025.13.0

### Minor Changes

- Amélioration de l'expérience mobile avec menus d'actions pour les transactions et lignes budgétaires.

  Les boutons "Éditer" et "Supprimer" sont désormais regroupés dans un menu contextuel (3 points verticaux) sur les appareils mobiles, ce qui réduit l'encombrement visuel et améliore l'ergonomie tactile. Sur desktop, les boutons restent affichés séparément pour un accès rapide.

## 2025.12.0

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
