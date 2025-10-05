# Product Specification: Pulpe (V1)

## 1. Vision & Philosophie

### Philosophie Produit

* **Planning** > Tracking (Planifier plutôt que subir)
* **Anticipation** > Reaction (Prévoir plutôt que réagir)
* **Serenity** > Control (Sérénité plutôt que contrôle obsessionnel)
* **Simplicity** > Completeness (Simplicité plutôt qu'exhaustivité)

### Proposition de Valeur

> Pulpe permet de planifier l'année avec des modèles de mois réutilisables. L'utilisateur sait toujours combien il peut dépenser et combien il va épargner.

### Parcours Utilisateur Type

```
1. Onboarding    : Configuration du profil + revenus + charges fixes
2. Templates     : Création de modèles de mois réutilisables
3. Budgets       : Génération automatique des budgets mensuels depuis les templates
4. Tracking      : Ajustement via saisie des transactions réelles
5. Monitoring    : Visualisation de l'épargne et du disponible
```

---

## 2. Concepts Métier & Définitions

### Types de Flux Financiers

* **Income** (Revenu) : Toute entrée d'argent dans le budget mensuel
* **Expense** (Dépense) : Toute sortie d'argent du budget mensuel
* **Saving** (Épargne) : Objectif de mise de côté, traité comptablement comme une sortie d'argent pour garantir sa réalisation

> 💡 **Note importante** : Le saving est volontairement traité comme une expense dans les calculs pour forcer l'utilisateur à "budgéter" son épargne plutôt que d'épargner "ce qui reste".

### Concepts de Gestion

* **Template** : Modèle réutilisable de mois contenant la structure des revenus, dépenses et épargne prévus
* **Budget** : Instance mensuelle créée à partir d'un template, modifiable indépendamment
* **Budget Line** : Ligne de budget planifiée (income, expense ou saving)
* **Transaction** : Opération réelle saisie par l'utilisateur pour ajuster le budget

### Indicateurs Calculés

* **Available** (Disponible) : Montant total utilisable pour le mois = `Income + Rollover`
  * *Représente l'argent total à disposition pour le mois en cours*
  
* **Expenses** (Dépenses totales) : `Σ(budget_lines type expense/saving) + Σ(transactions type expense/saving)`
  * *Somme de toutes les sorties d'argent planifiées et réelles*
  
* **Remaining** (Restant) : `Available - Expenses`
  * *Montant encore disponible à dépenser dans le mois*

* **Progress** (Progression) : `(Expenses ÷ Available) × 100`
  * *Pourcentage du budget consommé (plafonné visuellement à 100%)*

---

## 3. Modèle de Calcul

### Principe de Base

Le système repose sur un **chaînage automatique** des mois via le mécanisme de rollover :

```
Mois M   : ending_balance = (income + rollover_from_M-1) - expenses
Mois M+1 : rollover = ending_balance_from_M
```

### Stockage & Calcul

* **Stocké en base** : `ending_balance` pour chaque mois
* **Calculé dynamiquement** : `rollover` depuis l'ending_balance du mois précédent
* **Premier mois** : rollover = 0 (pas de mois précédent)

### Formules Détaillées

```sql
-- Pour un mois M donné :
income_M        = SUM(budget_lines WHERE type = 'income')
expenses_M      = SUM(budget_lines WHERE type IN ('expense', 'saving')) 
                + SUM(transactions WHERE type IN ('expense', 'saving'))
rollover_M      = ending_balance_M-1  -- (0 si premier mois)
available_M     = income_M + rollover_M
remaining_M     = available_M - expenses_M
ending_balance_M = remaining_M  -- Stocké en base
```

### Exemple de Chaînage

```
Janvier  : income=5000 CHF, expenses=4500 CHF, rollover=0     → ending_balance=500 CHF
Février  : income=5200 CHF, expenses=4800 CHF, rollover=500 CHF  → ending_balance=900 CHF
Mars     : income=5100 CHF, expenses=5200 CHF, rollover=900 CHF  → ending_balance=800 CHF
Avril    : income=5000 CHF, expenses=5500 CHF, rollover=800 CHF  → ending_balance=300 CHF
```

> ⚠️ **Important** : Un ending_balance négatif se propage automatiquement comme rollover négatif au mois suivant (dette technique).

---

## 4. Hypothèses & Limitations

### Ce que Pulpe V1 fait

✅ Planification annuelle basée sur des templates  
✅ Suivi mensuel des dépenses vs budget  
✅ Propagation automatique des excédents/déficits  
✅ Alertes de dépassement budgétaire  
✅ Distinction plan (budget_lines) vs réel (transactions)  

### Ce que Pulpe V1 NE fait PAS

❌ **Pas de multi-devises** : CHF uniquement (contexte Suisse)  
❌ **Pas de comptes bancaires** : Pas de synchronisation ou réconciliation bancaire  
❌ **Pas de budgets partagés** : Un budget par utilisateur uniquement  
❌ **Pas de catégorisation avancée** : Les transactions ne sont pas sous-catégorisées  
❌ **Pas de récurrence automatique** : Les transactions régulières doivent être saisies manuellement  
❌ **Pas d'objectifs long terme** : Focus sur le mois, pas de projections annuelles  
❌ **Pas de modification rétroactive** : Les mois clôturés sont figés (sauf ending_balance)  

### Hypothèses Métier

* L'utilisateur a des revenus réguliers mensuels
* L'épargne est un objectif prioritaire (pas un reste)
* Un déficit se reporte automatiquement (pas de blocage)
* L'utilisateur accepte une saisie manuelle des transactions

---

## 5. Workflows Principaux

### WF-000: Onboarding

**Objectif** : Permettre à l'utilisateur de démarrer immédiatement avec un budget fonctionnel

1. Saisie des informations de base (revenus + charges fixes)
2. Création automatique d'un template "Standard Month"
3. Génération du budget du mois en cours depuis ce template
4. Redirection vers le dashboard du mois courant

### WF-001: Planification Annuelle

**Objectif** : Générer rapidement 12 mois de budgets prévisionnels

1. Sélection d'un template de référence
2. Choix de la période (par défaut : année calendaire)
3. Génération de 12 budgets identiques
4. Possibilité d'ajuster chaque mois individuellement (primes, vacances, etc.)

### WF-002: Suivi Mensuel

**Objectif** : Suivre sa consommation budgétaire en temps réel

1. Consultation du dashboard (available, remaining, progress)
2. Ajout de transactions au fil de l'eau
3. Réception d'alertes aux seuils (80%, 90%, 100%)
4. Clôture automatique en fin de mois avec calcul du rollover

### WF-003: Mode Démo

**Objectif** : Permettre l'exploration de l'application sans inscription

1. Clic sur "Essayer en mode démo" (login ou onboarding)
2. Création automatique d'un utilisateur éphémère (backend)
3. Génération de données réalistes (templates, budgets, transactions)
4. Session active 24h avec auto-cleanup après expiration

---

## 6. Règles Métier

### RG-001: Cohérence Template ↔ Budget

* Lors de la modification d'un template (ajout/édition/suppression de lignes), deux options sont proposées :
  - **"Ne rien propager"** : Modifie uniquement le template. Les budgets existants ne sont PAS touchés. Seuls les nouveaux budgets créés après utiliseront le template modifié.
  - **"Propager"** : Modifie le template ET applique les changements aux budgets du mois en cours et futurs (jamais aux mois passés)
* Les budget lines manuellement ajustées (is_manually_adjusted = true) ne sont jamais modifiées lors de la propagation

### RG-002: Gestion des Dépassements

* **Seuil 80%** : Notification d'avertissement (orange)
* **Seuil 90%** : Alerte forte (rouge)
* **Seuil 100%+** : Dépassement autorisé avec rollover négatif au mois suivant

### RG-003: Atomicité des Opérations

* Création de budget depuis template : transaction complète ou annulation
* Modification de template : validation avant propagation
* Import de transactions : tout ou rien avec rapport d'erreur

### RG-004: Unicité et Contraintes

* Un seul template peut être marqué "default" par utilisateur
* Un seul budget par mois par utilisateur
* Au moins une ligne de type income obligatoire dans un template
* La somme expenses + savings ne doit pas dépasser les incomes dans un template (avertissement)

### RG-005: Gestion des Transactions

* Les transactions sont saisies manuellement par l'utilisateur
* Elles s'ajoutent aux budget lines (ne les remplacent pas)
* Pas de modification des transactions après saisie (V1)
* Les transactions impactent directement le calcul du remaining

---

## 7. Cas d'Usage Détaillés

### CU-001: Dashboard Mensuel

**Acteur** : Utilisateur connecté  
**Précondition** : Budget du mois existe  

**Affichage principal** :
- Montant available (grande police, position centrale)
- Montant remaining avec code couleur selon progression
- Barre de progression visuelle (vert → orange → rouge)
- Liste des 5 dernières transactions

**Actions rapides** :
- Bouton "Add Transaction" (flottant)
- Accès "View All Transactions"
- Lien "Edit Budget"

### CU-002: Création de Template Personnalisé

**Acteur** : Utilisateur connecté  
**Précondition** : Au moins un template existe déjà  

**Étapes** :
1. Duplication d'un template existant ou création vierge
2. Ajout/modification des lignes (au moins 1 income obligatoire)
3. Validation : vérification que expenses + savings ≤ income
4. Option : marquer comme template par défaut
5. Option : propager aux mois futurs

### CU-003: Gestion d'un Dépassement

**Acteur** : Utilisateur avec budget dépassé  
**Déclencheur** : remaining < 0  

**Comportement système** :
1. Notification immédiate à l'utilisateur
2. Affichage en rouge du montant dépassé
3. Calcul et affichage de l'impact sur le mois suivant
4. Proposition d'ajustement du budget du mois suivant

---

## 8. Glossaire Métier

| Terme EN | Terme FR | Définition | Contexte d'usage |
|----------|----------|------------|------------------|
| **Template** | Modèle | Structure réutilisable définissant les revenus, dépenses et épargne types d'un mois | "J'utilise mon template 'Mois standard' pour générer mes budgets" |
| **Budget** | Budget mensuel | Instance concrète d'un template pour un mois donné, modifiable indépendamment | "Mon budget de janvier est basé sur le template mais j'ai ajouté une prime" |
| **Budget Line** | Ligne budgétaire | Élément planifié du budget (salaire, loyer, épargne...) | "J'ai 15 budget lines dont 2 revenus et 13 dépenses" |
| **Transaction** | Transaction | Opération réelle saisie pour ajuster le budget par rapport au plan | "J'ai ajouté une transaction de 45 CHF pour le restaurant d'hier" |
| **Income** | Revenu | Entrée d'argent dans le budget mensuel | "Mes incomes incluent salaire + freelance" |
| **Expense** | Dépense | Sortie d'argent du budget (hors épargne) | "Mon expense loyer est de 1800 CHF" |
| **Saving** | Épargne | Montant mis de côté, traité comme une sortie prioritaire | "Mon saving mensuel est de 500 CHF pour le projet vacances" |
| **Available** | Disponible | Montant total utilisable ce mois (revenus + report) | "J'ai 5200 CHF available ce mois-ci" |
| **Remaining** | Restant | Ce qu'il reste à dépenser dans le mois | "Plus que 340 CHF remaining pour finir le mois" |
| **Ending Balance** | Solde de fin | Résultat final du mois après toutes les opérations | "Mon ending balance de janvier était de +200 CHF" |
| **Rollover** | Report | Excédent ou déficit reporté automatiquement au mois suivant | "J'ai un rollover négatif de -150 CHF suite au dépassement" |
| **Progress** | Progression | Pourcentage du budget consommé | "Je suis à 85% de progress, attention!" |
| **Overspending** | Dépassement | Situation où les dépenses excèdent le disponible | "Overspending de 200 CHF ce mois" |
| **Default Template** | Modèle par défaut | Template utilisé automatiquement si aucun choix explicite | "Mon default template inclut tous mes frais fixes" |

---

## 9. Évolutions Futures (hors V1)

* 🔮 Multi-devises avec taux de change
* 🔮 Budgets partagés (couple, famille)
* 🔮 Catégorisation avancée des transactions
* 🔮 Récurrence automatique des transactions
* 🔮 Projections et simulations
* 🔮 Export PDF/Excel des budgets
* 🔮 Synchronisation bancaire (PSD2)
* 🔮 Mode "vacances" avec budget journalier

---

*Document maintenu par l'équipe Pulpe - Dernière mise à jour : Version 1.0*