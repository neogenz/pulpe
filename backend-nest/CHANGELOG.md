# backend-nest

## 0.11.0

### Minor Changes

- Tableau de bord iOS, refonte pages d'authentification, corrections toggle-check et dates.

### Patch Changes

- Updated dependencies
  - pulpe-shared@0.7.0

## 0.10.0

### Minor Changes

- ## Nouvelles fonctionnalités
  - **Suppression de compte** - Les utilisateurs peuvent supprimer leur compte avec un délai de grâce de 3 jours pour annuler
  - **Migrations de stockage typées** - Système de migration robuste pour les préférences locales
  - **UI Budget améliorée** - Anneau dynamique pour budgets négatifs, boutons alignés à droite

  ## Corrections
  - Restauration de l'abstraction du service API pour le toggle des lignes budgétaires

### Patch Changes

- Updated dependencies
  - pulpe-shared@0.6.0

## 0.9.0

### Minor Changes

- ### Nouvelles Fonctionnalités
  - **Mode maintenance** - Endpoint et configuration pour activer un mode maintenance applicatif
  - **Logging RGPD** - Logs backend conformes avec anonymisation des IPs et agents simplifiés

## 0.8.0

### Minor Changes

- Mode maintenance, nouvelles icônes iOS, correction navigation et conformité RGPD
  - Nouvelle page de maintenance avec animation affichée automatiquement
  - Design citron moderne pour l'icône iOS
  - Correction d'un problème de navigation bloquée au démarrage
  - Anonymisation des IPs pour la conformité RGPD

## 0.7.0

### Minor Changes

- ### Nouvelles fonctionnalités
  - **Mode maintenance** : Nouvelle page de maintenance avec animation Lottie et guard pour bloquer l'accès
  - **Nouvelles icônes** (iOS) : Design rafraîchi avec thème citron

  ### Corrections
  - **Navigation** : Résolution du problème de navigation bloquée au démarrage
  - **Authentification** : Correction du flux de navigation depuis login/signup
  - **Tutoriel** : Persistance de l'état du tutoriel entre les sessions
  - **UI** : Amélioration de l'affichage du composant d'alerte d'erreur
  - **iOS** : Résolution des warnings compilateur et espacement amélioré

## 0.6.1

### Patch Changes

- Correction du calcul des enveloppes budgétaires et amélioration de l'interface

  **Calcul des enveloppes:** Les transactions allouées à une enveloppe n'impactent plus le budget disponible deux fois. Seul le dépassement de l'enveloppe affecte maintenant le budget restant.

  **Interface:** Animations staggered sur la liste, sections d'années repliables, meilleure typographie et indicateurs de statut.

  **Fixe:** Widgets budgétaires n'affichant que 2 mois au lieu de tous. Amélioration d'accessibilité iOS. Données de test cohérentes.

- Updated dependencies
  - pulpe-shared@0.5.1

## 0.6.0

### Minor Changes

- ### Nouvelles fonctionnalités
  - **Jour de début de période personnalisable** : Configurez le jour du mois où commence votre période budgétaire (jour de paie). Le calcul du report et l'affichage des périodes s'adaptent automatiquement à votre cycle de paie. Accessible depuis les paramètres et l'onboarding.

### Patch Changes

- Updated dependencies
  - pulpe-shared@0.5.0

## 0.5.0

### Minor Changes

- ### Nouvelles fonctionnalités
  - **Recherche globale de transactions** : Recherchez des transactions sur l'ensemble de vos budgets depuis la liste des budgets, avec filtrage par texte et année
  - **Filtre par année** : Affinez vos recherches de transactions en sélectionnant une année spécifique
  - **Description de budget optionnelle** : La description n'est plus obligatoire lors de la création d'un budget

  ### Corrections
  - **Déconnexion améliorée** : La déconnexion effectue maintenant un rechargement complet de la page pour garantir l'effacement de toutes les données en mémoire

### Patch Changes

- Updated dependencies
  - pulpe-shared@0.4.0

## 0.4.2

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

- Updated dependencies
  - pulpe-shared@0.3.1

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
  - pulpe-shared@0.3.0

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
  - pulpe-shared@0.2.1

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
  - pulpe-shared@0.2.0
