# Règles Métier - Système de Rollover et Disponible à Dépenser

> **Application Pulpe** - Gestion financière avec rollover cumulatif  
> **Dernière mise à jour** : 29 août 2025

---

## 🎯 Concept Fondamental : Disponible à Dépenser (Available to Spend)

Le **Disponible à Dépenser** représente **le montant total que l'utilisateur peut dépenser pour le mois en cours**, incluant le report du mois précédent. C'est le concept central affiché à l'utilisateur dans l'application Pulpe.

### Vision Métier
- **Philosophie** : Planning > Tracking | Anticipation > Réaction | Sérénité > Contrôle
- **Message utilisateur** : "Vous savez toujours combien vous pouvez dépenser et combien vous allez économiser"

---

## 📐 Formules de Calcul

### 1. Fixed Block (Bloc Fixe)
```
Fixed Block = Toutes les Dépenses + Toutes les Épargnes Prévues
```

**Définition :** Le Fixed Block représente tout ce qui est "prévu" et "planifié" pour le mois dans les budget_lines. Il constitue la base du plan mensuel.

**Composants :**
- Dépenses fixes (loyer, assurances, abonnements)
- Épargne planifiée (objectifs d'épargne, provisions)
- Dépenses variables prévues (alimentation, transport)

### 2. Ending Balance (Solde de Fin de Mois) - VALEUR STOCKÉE
```
Ending Balance = Σ(Revenus) - Σ(Dépenses + Épargnes)
                 depuis budget_lines ET transactions
```

**Définition :** Le solde "pur" du mois, SANS tenir compte du rollover. Cette valeur est **persistée dans la base de données** (`monthly_budget.ending_balance`).

**Caractéristiques :**
- Calculé une seule fois et stocké
- Inclut TOUS les mouvements du mois (budget_lines + transactions)
- Ne contient PAS le rollover du mois précédent
- Sert de rollover pour le mois suivant

### 3. Rollover (Report du Mois Précédent)
```
Rollover du mois N = Ending Balance du mois N-1
```

**Définition :** Le montant reporté du mois précédent. C'est simplement l'ending_balance du mois précédent.

### 4. Disponible à Dépenser (Available to Spend) - VALEUR AFFICHÉE
```
Disponible à Dépenser = Ending Balance (mois actuel) + Rollover (du mois précédent)
```

**Définition :** Le montant final affiché à l'utilisateur, combinant le solde du mois actuel et le report du mois précédent.

---

## 💰 Le Système de Rollover

### Principe du Rollover Cumulatif

Le rollover fonctionne comme un **compte bancaire** où le solde se reporte automatiquement de mois en mois, créant un effet cumulatif naturel SANS récursivité.

#### Exemple Concret avec la Nouvelle Architecture

**Janvier :**
- Revenus (budget_lines) : 5000€
- Dépenses + Épargnes (budget_lines) : 4000€
- Transactions : 0€
- **Ending Balance Janvier (stocké) : 1000€**
- Rollover reçu : 0€ (premier mois)
- **Disponible à Dépenser affiché : 1000€**

**Février :**
- Revenus (budget_lines) : 5000€
- Dépenses + Épargnes (budget_lines) : 3000€
- Transactions : 0€
- **Ending Balance Février (stocké) : 2000€**
- Rollover reçu (= Ending Balance Janvier) : 1000€
- **Disponible à Dépenser affiché : 3000€**

**Mars :**
- Revenus (budget_lines) : 5000€
- Dépenses + Épargnes (budget_lines) : 4500€
- Transactions : -200€ (dépense réelle)
- **Ending Balance Mars (stocké) : 300€** (5000 - 4500 - 200)
- Rollover reçu (= Ending Balance Février) : 2000€
- **Disponible à Dépenser affiché : 2300€**

### Règles Métier du Rollover

#### RG-001 : Rollover Direct (Non-Récursif)
- Le rollover du mois N est **EXACTEMENT** l'ending_balance du mois N-1
- **Positif** = excédent reporté (bonus pour le mois suivant)
- **Négatif** = déficit reporté (à rattraper le mois suivant)
- **Pas de calcul en cascade** : on lit simplement la valeur stockée

#### RG-002 : Architecture Sans Récursivité
- **Pourquoi pas de récursivité ?** L'ending_balance de chaque mois est calculé et stocké indépendamment
- **L'effet cumulatif est naturel** : Février stocke son solde total, Mars le reçoit comme rollover
- **Pas de recalcul en chaîne** : Chaque ending_balance est définitif une fois calculé

#### RG-003 : Indépendance des Calculs
- Chaque mois calcule son ending_balance de manière **autonome**
- Modifier Mars ne recalcule **PAS** Avril, Mai, etc.
- L'ending_balance inclut TOUT : budget_lines + transactions du mois
- Le rollover est une simple lecture de l'ending_balance précédent

#### RG-004 : Stratégie de Persistance
```sql
-- Stocké dans monthly_budget.ending_balance
ending_balance = Σ(revenus) - Σ(dépenses + épargnes)
                 -- Inclut budget_lines ET transactions
                 -- N'inclut PAS le rollover reçu
```

---

## 🔄 Flux de Données

### Composants d'un Budget Mensuel

1. **Budget Lines** (Le Plan Initial)
   - `type='income'` : Revenus planifiés
   - `type='expense'` : Dépenses planifiées  
   - `type='saving'` : Épargne planifiée

2. **Transactions** (Les Ajustements Réels)
   - Mouvements réels saisis au fil du mois
   - Impactent directement l'ending_balance
   - Types : income, expense, saving

3. **Ending Balance** (Le Résultat Stocké)
   - Calculé une fois : budget_lines + transactions
   - Persisté dans `monthly_budget.ending_balance`
   - Devient le rollover du mois suivant

4. **Rollover** (Le Report Automatique)
   - Simplement l'ending_balance du mois précédent
   - Lu directement depuis la base de données

### Calcul et Affichage

#### Calcul de l'Ending Balance (Stocké)
```
Ending Balance = 
  Σ(Budget Lines Income) + Σ(Transactions Income)
  - Σ(Budget Lines Expenses + Savings) 
  - Σ(Transactions Expenses + Savings)
```

#### Affichage du Disponible à Dépenser
```
Disponible à Dépenser = 
  Ending Balance (mois actuel, depuis DB)
  + Rollover (ending_balance du mois précédent, depuis DB)
```

---

## 📝 Règles d'Affichage

### Pour l'Utilisateur

#### Affichage Principal
- Montrer le **Disponible à Dépenser** de manière proéminente
- Message type : "Disponible à dépenser : 2300€"
- Cette valeur combine automatiquement l'ending_balance actuel + rollover

#### Détail du Rollover (Optionnel)
- Peut afficher le rollover séparément pour transparence
- **Si positif** : "Report du mois précédent : +800€" 
- **Si négatif** : "Déficit reporté : -200€"

#### Ligne de Rollover Virtuelle (Pour l'Affichage)
- **Nom** : Format "Rollover de [Mois Année]" (ex: "Rollover de Février 2025")
- **Type** : 'income' si positif, 'expense' si négatif
- **Montant** : Valeur absolue de l'ending_balance du mois précédent
- **Caractéristiques** : `isRollover: true`, `recurrence: 'one_off'`
- **Note** : Cette ligne est créée dynamiquement pour l'affichage uniquement

---

## ⚠️ Gestion des Cas Limites

### CL-001 : Premier Budget Utilisateur
- **Contexte** : Aucun budget précédent n'existe
- **Comportement** : Rollover = 0€
- **Affichage** : Disponible à Dépenser = Ending Balance seul

### CL-002 : Budget Manquant
- **Contexte** : Un mois intermédiaire n'a pas de budget
- **Comportement** : Rollover = 0€ pour le mois suivant
- **Exemple** : Janvier existe, Mars existe, mais pas Février → Rollover Mars = 0€

### CL-003 : Ending Balance Non Calculé
- **Contexte** : L'ending_balance du mois précédent est NULL
- **Comportement** : Calcul à la volée et persistance
- **Performance** : Le calcul n'est fait qu'une fois, puis stocké

### CL-004 : Modification Rétroactive
- **Contexte** : L'utilisateur modifie un budget ou ajoute des transactions à un mois passé
- **Comportement** : 
  1. Recalculer et mettre à jour l'ending_balance de ce mois
  2. Les mois suivants utilisent automatiquement la nouvelle valeur comme rollover
- **Pas de cascade** : On ne recalcule PAS les ending_balance des mois suivants

---

## 🏗️ Architecture Technique

### Stratégie de Persistance Sans Récursivité

#### Pourquoi Pas de Récursivité ?
1. **Performance** : Chaque ending_balance est calculé une seule fois
2. **Simplicité** : Pas de dépendances en chaîne à gérer
3. **Fiabilité** : Pas de risque de boucle infinie
4. **Scalabilité** : Le temps de calcul reste constant peu importe l'historique

#### Le Stockage de l'Ending Balance
```sql
ALTER TABLE monthly_budget 
ADD COLUMN ending_balance NUMERIC(10,2);

-- Valeur calculée et stockée une seule fois
-- Inclut TOUS les mouvements du mois
-- N'inclut PAS le rollover reçu
```

### Flux de Calcul

#### 1. Calcul Initial
```typescript
// Lors de la première demande
if (budget.ending_balance === null) {
  ending_balance = calculateFromBudgetLinesAndTransactions();
  await persistToDatabase(ending_balance);
}
return ending_balance;
```

#### 2. Mise à Jour Suite aux Changements
```typescript
// Quand budget_lines ou transactions changent
ending_balance = recalculateFromAllSources();
await updateInDatabase(ending_balance);
// Pas de propagation aux mois suivants
```

#### 3. Lecture du Rollover
```typescript
// Simple lecture, pas de calcul
rollover = previousMonth.ending_balance ?? 0;
```

### Événements et Recalcul

#### Événements Déclencheurs de Recalcul
1. **Ajout/modification/suppression de budget_line**
2. **Ajout/modification/suppression de transaction**
3. **Import de template** (création de nouvelles budget_lines)

#### Stratégie de Recalcul
- **Scope** : Uniquement le mois concerné
- **Méthode** : Recalcul complet depuis budget_lines + transactions
- **Persistance** : Mise à jour immédiate de ending_balance
- **Impact** : Aucun sur les autres mois (ils gardent leur ending_balance)

---

## 🎭 Vocabulaire Métier

| Terme Technique | Terme Utilisateur | Définition |
|-----------------|-------------------|------------|
| **ending_balance** | - | Solde pur du mois stocké en DB (revenus - dépenses de TOUTES sources) |
| **Available to Spend** | Disponible à dépenser | Montant affiché à l'utilisateur (ending_balance + rollover) |
| **Rollover** | Report | ending_balance du mois précédent utilisé comme bonus/déficit |
| **Fixed Block** | Bloc fixe | Ensemble des dépenses et épargnes planifiées dans budget_lines |
| **Budget Lines** | Prévisions | Lignes de budget planifiées (revenus/dépenses/épargnes prévus) |
| **Transactions** | Transactions | Mouvements réels saisis par l'utilisateur |
| **Template** | Modèle | Structure de mois réutilisable |
| **Instantiation** | - | Création technique d'un budget mensuel depuis un template |
| **Rollover Line** | Ligne de report | Ligne virtuelle d'affichage pour montrer le rollover |

---

## 📊 Exemples Pratiques

### Scénario A : Mois Équilibré
```
Budget Mars :
├── Revenus (budget_lines) : 4000€
├── Dépenses + Épargne (budget_lines) : 3800€
├── Transactions : -50€ (courses supplémentaires)
├── Ending Balance Mars (stocké) : 150€
│   └── Calcul : 4000 - 3800 - 50 = 150€
├── Rollover reçu (ending_balance Février) : 500€
└── Disponible à Dépenser (affiché) : 650€
    └── Calcul : 150 + 500 = 650€
```

### Scénario B : Dépassement du Budget
```
Budget Avril :
├── Revenus (budget_lines) : 4000€
├── Dépenses + Épargne (budget_lines) : 3600€
├── Transactions : -600€ (imprévus)
├── Ending Balance Avril (stocké) : -200€
│   └── Calcul : 4000 - 3600 - 600 = -200€
├── Rollover reçu (ending_balance Mars) : 150€
└── Disponible à Dépenser (affiché) : -50€
    └── Calcul : -200 + 150 = -50€ (déficit)
```

### Scénario C : Récupération avec Bonus
```
Budget Mai :
├── Revenus (budget_lines) : 4500€ (inclut bonus)
├── Dépenses + Épargne (budget_lines) : 4000€
├── Transactions : -200€
├── Ending Balance Mai (stocké) : 300€
│   └── Calcul : 4500 - 4000 - 200 = 300€
├── Rollover reçu (ending_balance Avril) : -200€ (déficit)
└── Disponible à Dépenser (affiché) : 100€
    └── Calcul : 300 + (-200) = 100€
```

---

## 🔄 Workflow Utilisateur

### 1. Création du Budget Mensuel
1. L'utilisateur sélectionne un template
2. Le système instancie le budget avec les budget_lines
3. Le système calcule et stocke l'ending_balance initial (sans transactions)
4. Le système récupère le rollover (ending_balance du mois précédent)
5. **Affichage** : "Disponible à dépenser : [ending_balance + rollover]€"

### 2. Saisie de Transactions
1. L'utilisateur saisit une transaction (dépense/revenu)
2. Le système recalcule et met à jour l'ending_balance du mois
3. Le système récupère toujours le même rollover (inchangé)
4. **Affichage mis à jour** : "Disponible à dépenser : [nouvel ending_balance + rollover]€"

### 3. Consultation du Mois Suivant
1. Le système lit l'ending_balance du mois actuel (déjà calculé)
2. Cet ending_balance devient automatiquement le rollover du mois suivant
3. **Pas de recalcul en cascade** : Simple lecture de valeurs stockées
4. **Résultat** : Report automatique et transparent

---

## 🎯 Impact Business et UX

### Bénéfices Utilisateur
- **Transparence totale** : Un seul chiffre "Disponible à dépenser" qui dit tout
- **Effet cumulatif naturel** : Les économies se reportent automatiquement
- **Responsabilisation douce** : Les excès se rattrapent naturellement le mois suivant
- **Zéro complexité** : Pas de calculs, juste un montant clair

### Bénéfices Techniques
- **Performance optimale** : Pas de recalculs récursifs
- **Architecture simple** : Chaque mois est indépendant
- **Fiabilité** : Pas de risque de boucle infinie ou d'erreur en cascade
- **Scalabilité** : Le système reste rapide même avec des années d'historique

### Différenciation Produit
- **Rollover intelligent** : Automatique et cumulatif comme un vrai compte
- **Vision claire** : Toujours savoir où on en est financièrement
- **Approche moderne** : Focus sur le disponible, pas sur les détails comptables
- **Évolutivité** : Architecture prête pour des features avancées (prédictions, IA, etc.)

---

## 📌 Points Clés à Retenir

1. **ending_balance** = Valeur technique stockée (le "vrai" solde du mois)
2. **Disponible à dépenser** = Ce que voit l'utilisateur (ending_balance + rollover)
3. **Pas de récursivité** = Chaque mois est calculé indépendamment
4. **Rollover automatique** = Simple lecture de l'ending_balance précédent
5. **Performance garantie** = Un seul calcul par mois, puis lecture depuis la DB

---

*Cette documentation constitue la référence métier complète pour le système de rollover et de "Disponible à Dépenser" de l'application Pulpe.*