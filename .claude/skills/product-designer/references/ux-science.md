# Principes UX scientifiques et methodologies

Reference pour argumenter les decisions produit avec des sources verifiables.

## 1. Lois fondamentales de l'interaction

### Loi de Fitts (1954)

**Source** : Fitts, P.M. "The information capacity of the human motor system in controlling the amplitude of movement." *Journal of Experimental Psychology*, 47(6), 381-391.

**Principe** : Le temps pour atteindre une cible est fonction de la distance et de la taille de la cible.

`T = a + b × log2(2D/W)`

**Application** :
- Les boutons d'action primaire doivent etre grands (min 48pt touch target) et proches du point d'attention
- Sur mobile, la zone du pouce (arc inferieur de l'ecran) est la zone premium
- Les actions frequentes (ajouter une transaction) doivent etre accessibles sans mouvement de main
- Les actions destructives doivent etre petites et eloignees des actions frequentes

### Loi de Hick-Hyman (1952)

**Source** : Hick, W.E. "On the rate of gain of information." *Quarterly Journal of Experimental Psychology*, 4(1), 11-26.

**Principe** : Le temps de decision augmente logarithmiquement avec le nombre de choix.

`T = b × log2(n + 1)`

**Application** :
- Limiter les options visibles simultanement (progressive disclosure)
- L'onboarding doit presenter les champs un par un, pas tous d'un coup
- Les menus de navigation doivent avoir max 5 onglets (apps e-banking suisses : 4-5)
- Categoriser les choix plutot que les lister a plat

### Loi de Miller (1956)

**Source** : Miller, G.A. "The magical number seven, plus or minus two." *Psychological Review*, 63(2), 81-97.

**Principe** : La memoire de travail peut traiter 7 ± 2 elements simultanement.

**Application** :
- Un dashboard ne doit pas montrer plus de 5-7 metriques
- Les listes de budget lines doivent etre groupees par categorie (revenu, depense, epargne)
- Les formulaires longs doivent etre decoupes en etapes

### Loi de Jakob (Nielsen, 2000)

**Source** : Nielsen, J. "Jakob's Law of Internet User Experience." *Nielsen Norman Group*.

**Principe** : Les utilisateurs passent la majorite de leur temps sur d'AUTRES apps. Ils s'attendent a ce que la tienne fonctionne pareil.

**Application** :
- Suivre les conventions des apps e-banking suisses (montant hero en haut, liste de transactions, gestes natifs)
- Pull-to-refresh pour actualiser
- Swipe pour actions contextuelles
- Bottom sheet pour formulaires secondaires
- Ne pas reinventer la navigation

### Loi de Tesler (Complexite irreductible)

**Source** : Tesler, L. "The Law of Conservation of Complexity." *Interactions*, 2007.

**Principe** : Chaque systeme a une complexite irreductible. La question est : qui la porte, l'utilisateur ou le systeme ?

**Application** :
- Le calcul des reports → le systeme (pas l'utilisateur avec des formules Excel)
- La propagation des changements de modele → le systeme
- Le chiffrement des montants → transparent pour l'utilisateur
- La reconciliation multi-comptes → l'utilisateur saisit, le systeme agrege

### Seuil de Doherty (1982)

**Source** : Doherty, W.J. & Thadhani, A.J. "The Economic Value of Rapid Response Time." *IBM Systems Journal*.

**Principe** : En dessous de 400ms de temps de reponse, l'utilisateur percoit le systeme comme instantane. Au-dessus, la satisfaction chute.

**Application** :
- Feedback immediat sur ajout de transaction (mise a jour du "Disponible" avant confirmation serveur)
- Optimistic updates pour les operations courantes
- Skeletons screens pour les chargements > 400ms

## 2. Heuristiques de Nielsen (1994)

**Source** : Nielsen, J. "10 Usability Heuristics for User Interface Design." *Nielsen Norman Group*.

| # | Heuristique | Application Pulpe |
|---|-------------|-------------------|
| 1 | **Visibilite du statut** | Le hero "Disponible" est toujours visible et a jour |
| 2 | **Correspondance monde reel** | Vocabulaire du quotidien ("Previsions", "Reel"), pas de jargon |
| 3 | **Controle utilisateur** | Undo sur les actions, choix de propagation, budgets ajustables |
| 4 | **Coherence et standards** | Suivre les conventions iOS/Material et e-banking |
| 5 | **Prevention des erreurs** | Valider les montants, confirmation sur actions destructives |
| 6 | **Reconnaissance > rappel** | Montrer les enveloppes existantes plutot que demander un ID |
| 7 | **Flexibilite** | Raccourcis pour utilisateurs frequents (FAB, gestes, widget) |
| 8 | **Design minimaliste** | Chaque ecran = un job. Progressive disclosure pour le reste |
| 9 | **Aide a la recuperation d'erreur** | Messages clairs avec suggestion d'action, pas de codes d'erreur |
| 10 | **Aide et documentation** | Empty states qui guident, onboarding contextuel |

## 3. Psychologie cognitive appliquee

### Charge cognitive (Sweller, 1988)

**Source** : Sweller, J. "Cognitive Load During Problem Solving." *Cognitive Science*, 12(2), 257-285.

Trois types de charge cognitive :
- **Intrinseque** : complexite du sujet (la finance EST complexe)
- **Extrinsique** : complexite ajoutee par le design (a eliminer)
- **Germane** : effort d'apprentissage utile (a faciliter)

**Application** : Pulpe doit absorber la charge intrinseque (calculs, reports) et eliminer la charge extrinsique (navigation confuse, jargon, etapes inutiles).

### Effet de position serielle (Murdock, 1962)

**Source** : Murdock, B.B. "The serial position effect of free recall." *Journal of Experimental Psychology*, 64(5), 482-488.

**Principe** : On retient mieux le premier (effet de primaute) et le dernier (effet de recence) element d'une serie.

**Application** :
- Le "Disponible a depenser" est toujours en premier (hero)
- Le CTA principal est en dernier (bas de l'ecran, zone du pouce)
- Les informations les moins critiques sont au milieu (progressive disclosure)

### Aversion a la perte (Kahneman & Tversky, 1979)

**Source** : Kahneman, D. & Tversky, A. "Prospect Theory." *Econometrica*, 47(2), 263-291.

**Principe** : Les pertes sont ressenties environ 2x plus intensement que les gains equivalents.

**Application** :
- Ne jamais presenter un depassement comme une "perte" — c'est un fait
- Le report negatif est explique factuellement, pas dramatise
- Le microcopy desamorce l'anxiete ("ca arrive", "tu le sais, et c'est deja ca")
- Montrer les progres positifs (epargne accumulee) autant que les ecarts

### Ancrage (Tversky & Kahneman, 1974)

**Source** : Tversky, A. & Kahneman, D. "Judgment under Uncertainty: Heuristics and Biases." *Science*, 185(4157), 1124-1131.

**Principe** : Le premier chiffre vu influence l'evaluation de tous les suivants.

**Application** :
- Le "Disponible a depenser" est le premier chiffre visible — il ancre la perception
- Dans l'onboarding, les montants suggerement pour les charges fixes ancrent des valeurs raisonnables
- Le montant planifie est toujours montre avant le reel (le planifie est l'ancre)

### Paradoxe du choix (Schwartz, 2004)

**Source** : Schwartz, B. *The Paradox of Choice: Why More Is Less*. Harper Perennial.

**Principe** : Plus de choix ne rend pas plus heureux. Au-dela de 5-6 options, la satisfaction chute et l'anxiete monte.

**Application** :
- L'onboarding pre-remplit les charges fixes courantes (loyer, assurance, tel, transport)
- Le modele "Mois Standard" est cree automatiquement — l'utilisateur ajuste, il ne part pas de zero
- Max 3 types de lignes (revenu, depense, epargne) — pas de sous-categories infinies

### Effet Zeigarnik (1927)

**Source** : Zeigarnik, B. "On finished and unfinished tasks." *Psychologische Forschung*, 9, 1-85.

**Principe** : On retient mieux les taches inachevees que les taches terminees. Elles creent une tension cognitive qui pousse a les completer.

**Application** :
- Les lignes "A pointer" creent un rappel implicite sans notification
- Les enveloppes non consommees montrent un etat "en attente"
- Le progres d'epargne montre ce qui reste a faire, pas seulement ce qui est fait

### Peak-End Rule (Kahneman, 1993)

**Source** : Kahneman, D. et al. "When More Pain Is Preferred to Less." *Psychological Science*, 4(6), 401-405.

**Principe** : On juge une experience par son moment le plus intense (peak) et par sa fin (end), pas par sa duree.

**Application** :
- Le peak = l'ouverture de l'app (hero card, le soulagement de voir le chiffre)
- La fin = la fermeture apres avoir note une depense (confirmation rapide, retour au hero mis a jour)
- Optimiser ces deux moments en priorite absolue

## 4. Methodologies de design

### Jobs To Be Done (Christensen, 2003)

**Source** : Christensen, C.M. "The Innovator's Solution." Harvard Business Press.

**Principe** : Les utilisateurs n'achetent pas des produits, ils "embauchent" des solutions pour un job precis dans un contexte precis.

**Application** : Chaque intention du BUSINESS_WORKFLOW.md est un "job". Le flow doit etre concu pour que le job soit accompli avec un minimum de friction.

### Progressive Disclosure (Nielsen, 2006)

**Source** : Nielsen, J. "Progressive Disclosure." *Nielsen Norman Group*.

**Principe** : Montrer d'abord l'essentiel, puis reveler les details sur demande.

**Application** :
- Dashboard : hero (essentiel) → sections repliees (details)
- Budget du mois : totaux par categorie → detail des lignes sur tap
- Modele : lignes recurrentes → options de propagation sur modification

### Friction intentionnelle

**Principe** : Parfois la friction est souhaitable pour eviter les erreurs couteuses.

**Application** :
- Confirmation avant suppression d'une ligne budgetaire
- Choix explicite de propagation (modele seul vs budgets futurs)
- PIN / Face ID au lancement (protege les donnees sensibles)
- Pas de suppression accidentelle possible par swipe seul

## 5. Metriques UX pertinentes

Pour mesurer la qualite d'un processus utilisateur :

| Metrique | Cible | Mesure |
|----------|-------|--------|
| **Time to Value** | < 5 min | Temps entre inscription et premier budget fonctionnel |
| **Task Completion Rate** | > 95% | % d'utilisateurs qui completent une action entamee |
| **Time on Task** (consultation) | < 10 sec | Temps entre ouverture et fermeture pour une simple consultation |
| **Time on Task** (saisie) | < 30 sec | Temps pour noter une depense |
| **Error Rate** | < 5% | % d'actions qui aboutissent a une erreur |
| **System Usability Scale (SUS)** | > 68 | Score de satisfaction (questionnaire standard) |
| **NPS** | > 50 | Net Promoter Score |
| **Retention J7** | > 60% | % d'utilisateurs actifs apres 7 jours |
| **Stickiness** | > 40% | DAU/MAU ratio (usage quotidien vs mensuel) |
