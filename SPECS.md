# Product Specification: Pulpe (V1)

## 1. Product Vision & Core Model

### Core Philosophy

* Planning > Tracking
* Anticipation > Reaction
* Serenity > Control
* Simplicity > Completeness

### Value Proposition

> Pulpe permet de planifier l’année avec des modèles de mois réutilisables. L’utilisateur sait toujours combien il peut dépenser et combien il va épargner.

### User Lifecycle

```
1. Onboarding: Profil + revenus + charges fixes
2. Templates: Création de modèles de mois
3. Budgets: Génération des budgets mensuels depuis les modèles
4. Tracking: Ajustements via saisie des transactions
5. Suivi: Visualisation de l’épargne disponible
```

---

## 2. Business Model

### Templates

Un **template** est un modèle de mois contenant : revenus, dépenses fixes, épargne prévue.

Exemple :

```
Template "Mois Standard"
├── Income
│   ├── Salaire: 6500 CHF
├── Expenses
│   ├── Loyer: 1800 CHF
│   ├── Assurance: 320 CHF
│   ├── Abonnements: 180 CHF
└── Savings
    ├── Epargne maison: 1200 CHF
```

### Monthly Budgets

Un **budget mensuel** est une instance de template :

* Les lignes sont copiées du template.
* Chaque ligne peut être modifiée indépendamment.

### Core Calculation Logic

* **Ending Balance (stocké)** :
  `ending_balance = revenus - (dépenses + épargne)` du mois courant uniquement.

* **Rollover (calculé dynamiquement)** :
  `rollover_N = available_to_spend_(N-1)`

* **Available to Spend (affiché)** :
  `available_to_spend_N = ending_balance_N + rollover_N`

Exemple simple :

```
Janvier : revenus 5000, dépenses 4500 → ending_balance = 500, rollover = 0 → dispo = 500
Février : revenus 5200, dépenses 4800 → ending_balance = 400, rollover = 500 → dispo = 900
Mars    : revenus 5100, dépenses 5200 → ending_balance = -100, rollover = 900 → dispo = 800
```

* Les économies sont traitées comme une dépense prioritaire (pas comme un reste).

---

## 3. Business Processes & Workflows

### WF-000: Onboarding

* L’utilisateur saisit ses revenus + dépenses fixes.
* Le système crée automatiquement :

  * Un template **"Mois Standard"** avec ces données.
  * Le budget du mois courant instancié depuis ce template.
* L’utilisateur arrive directement sur son premier budget utilisable.

### WF-001: Annual Planning

* L’utilisateur clique "Planifier l’année".
* Le système génère 12 mois identiques depuis un template choisi.
* Chaque mois est éditable individuellement.

### PM-001: Template Creation

* Au moins une ligne de revenu obligatoire.
* La somme dépenses + épargne ≤ revenus.
* Un template peut être marqué par défaut.
* Modification d’un template : option de propager aux budgets futurs.

### PM-002: Budget Generation

* Choix d’un template.
* Copie de ses lignes dans le budget du mois choisi.
* Lignes éditables après création.
* Calcul du solde de fin (`ending_balance`) + affichage du disponible (`available_to_spend`).

### PM-003: Monthly Tracking

* L’utilisateur consulte son budget du mois :

  * **Dépenses** = Σ(budget\_lines dépense+épargne) + Σ(transactions dépense+épargne)
  * **Disponible** = Σ(revenus) + rollover
  * **Restant** = Disponible - Dépenses
  * **Progress %** = (Dépenses ÷ Disponible) × 100 (cap visuel à 100%)

* Seuils d’alerte :

  * 80% → avertissement
  * 90% → alerte
  * 100%+ → dépassement

---

## 4. Business Rules (RG)

### RG-001: Template ↔ Budget Cohesion

* Les modifications de template peuvent être propagées aux budgets futurs.
* Les budgets passés sont figés (historique).
* Le budget du mois courant peut être modifié sur confirmation.

### RG-002: Calculation Model

* Stockage unique : `ending_balance` par mois.
* Le rollover est calculé dynamiquement à partir du mois précédent.
* L’`available_to_spend` est toujours calculé = `ending_balance + rollover`.

### RG-003: Overspending

* Alertes visuelles + notifications aux seuils (80, 90, 100%).
* Dépassement → report automatique sur le mois suivant (rollover négatif).

### RG-004: Atomic Budget Creation

* La création d’un budget depuis un template est transactionnelle (tout ou rien).

### RG-005: Plan vs Events

* **budget\_lines** = planification (revenus, dépenses, épargne).
* **transactions** = réel saisi manuellement.
* Les transactions n’écrasent pas les lignes, elles ajustent le solde de fin.

### RG-006: Unified Enum

* Enum unique : `income | expense | saving`.
* Utilisé de façon cohérente dans toutes les tables et API.

---

## 5. Use Cases (CU)

### CU-001: Dashboard mensuel

* Affiche :

  * Disponible à dépenser (valeur principale).
  * Restant (Disponible - Dépenses).
  * Barre de progression % avec code couleur.
* Actions rapides :

  * Ajouter une transaction.
  * Consulter l’historique.
  * Modifier le budget du mois.