# pulpe-shared

## 0.3.1

### Patch Changes

- ### Nouvelles fonctionnalités
  - **Export des budgets en JSON** : Exportez tous vos budgets avec leurs transactions et lignes budgétaires dans un fichier JSON depuis la liste des budgets
  - **Vérification des transactions** : Cochez vos transactions et lignes budgétaires pour suivre ce qui a été vérifié. Le cochage d'une ligne propage automatiquement aux transactions associées
  - **Barre de progression** : Visualisez l'avancement de vos éléments exécutés avec une barre de progression sur le solde réalisé
  - **Boîte "À propos"** : Accédez aux informations de version de l'application depuis le menu utilisateur

  ### Améliorations
  - **Fréquence automatique** : La fréquence des lignes est maintenant définie automatiquement selon le contexte (Prévu pour les budgets, Récurrent pour les templates)

  ### Corrections
  - **Sécurité des données** : Les données utilisateur sont maintenant correctement effacées à la déconnexion pour éviter toute fuite entre comptes
  - **Format de date** : Les dates s'affichent maintenant au format français (JJ.MM)

## 0.3.0

### Minor Changes

- Ajout du mode démo avec utilisateurs éphémères et protection anti-bot

  Nouvelle fonctionnalité permettant d'explorer l'application sans créer de compte :
  - **Mode démo sans inscription** : Bouton "Essayer en mode démo" sur les pages de connexion et d'onboarding
  - **Utilisateurs éphémères** : Sessions automatiques de 24 heures avec données de démonstration réalistes
  - **Protection anti-spam** : Intégration de Cloudflare Turnstile (invisible pour les utilisateurs légitimes)
  - **Nettoyage automatique** : Suppression programmée des comptes de démonstration expirés toutes les 6 heures
  - **Données pré-remplies** : Templates de budget, budgets mensuels (6 mois passés + 6 mois futurs), et transactions d'exemple

  Cette fonctionnalité améliore l'expérience d'onboarding en permettant aux utilisateurs d'évaluer l'application immédiatement, sans friction.

## 0.2.1

### Patch Changes

- Nouvelle fonctionnalité : Propagation intelligente des modèles de budget

  Les modifications apportées à vos modèles de budget peuvent maintenant être propagées vers vos budgets futurs. Le système protège automatiquement vos lignes personnalisées pour ne mettre à jour que les éléments non modifiés. Cette amélioration facilite la gestion de vos prévisions sur plusieurs mois.
  - Dialogue de confirmation lors de la modification d'un modèle
  - Protection des lignes modifiées manuellement
  - Propagation uniquement vers les budgets futurs
  - Préservation de vos ajustements personnalisés

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
