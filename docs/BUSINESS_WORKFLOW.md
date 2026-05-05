# Pulpe --- Besoins utilisateur

> Ce document est le blueprint des besoins humains auxquels Pulpe repond.
> Si une feature n'est pas rattachee a un besoin ci-dessous, elle n'a pas sa place.

---

## Pourquoi Pulpe existe

### La frustration d'origine

**Aucune app bancaire ne permet de planifier une annee complete facilement.**

Les apps du marche (Revolut, YNAB, etc.) sont faites pour *tracker* --- pas pour *anticiper*. Elles repondent a "combien j'ai depense ?" mais jamais a "est-ce que je peux me permettre des vacances en juillet sans exploser mon budget d'aout ?".

### Le calvaire Excel

Faute de mieux, la planification se fait sur Google Sheets. Ca marche, mais :

- **12 feuilles par an**, une par mois, avec des formules a refaire chaque annee
- **Modifier une charge fixe** (ex: nouvel abonnement a partir de septembre) = la changer manuellement sur chaque feuille de sept a dec
- **Inutilisable sur mobile** --- et c'est la qu'on a besoin de savoir combien il reste
- **Pas de report automatique** --- les excedents et deficits sont recalcules a la main
- **Pas de propagation** --- une erreur de formule se decouvre 3 mois trop tard

### Le cas concret : economiser pour acheter une maison

Le probleme devient encore plus douloureux avec un objectif long terme :

1. **Document A** : planification annuelle (12 feuilles, une par mois)
2. **Document B** : suivi de l'objectif maison sur 48 mois
3. Chaque mois : aller dans A, noter le reel, copier le montant d'epargne reelle dans B
4. Dans B : une formule calcule l'ecart planifie vs reel a l'instant T
5. Mais **pas de re-projection** : si j'ai economise 800.- au lieu de 2000.- en juillet, je dois recalculer manuellement l'impact sur les 41 mois restants
6. Zero aide pour redistribuer l'effort sur les mois suivants

L'utilisateur a besoin d'un outil ou l'epargne est budgetee, le reel se saisit en 10 secondes, les projections se recalculent en cascade, et l'ecart planifie/reel sur un objectif long terme est visible instantanement.

### Le probleme multi-comptes

Les depenses sont reparties sur plusieurs comptes bancaires (ex: Revolut + compte principal). Le tracking integre d'une seule banque ne sert a rien. L'utilisateur a besoin d'un outil agnostique du compte --- il saisit, peu importe d'ou vient la depense.

---

## Les 5 douleurs fondamentales

Chaque intention utilisateur repond a une ou plusieurs de ces douleurs. Si une feature ne soulage aucune d'entre elles, elle est hors scope.

| # | Douleur | Le cri utilisateur |
|---|---------|-------------------|
| D1 | **Pas de vision** | "Je ne sais pas combien je peux depenser" |
| D2 | **Pas de propagation** | "Changer un truc = le refaire partout a la main" |
| D3 | **Pas d'anticipation** | "Je decouvre les problemes trop tard" |
| D4 | **Pas de mobilite** | "Excel est inutilisable sur telephone" |
| D5 | **Pas de projection long terme** | "Je dois jongler entre 2 documents et tout recalculer a la main chaque mois pour suivre mon objectif sur 4 ans" |

---

## Les intentions utilisateur

Chaque intention = un vrai moment de vie. Chaque feature de Pulpe doit servir au moins l'une d'entre elles.

---

### 1. "Je veux essayer sans m'inscrire"

**Besoin** : decouvrir la valeur du produit sans friction, sans engagement.

**Douleurs** : D1

**Scenario** :
1. L'utilisateur arrive sur Pulpe
2. Il clique "Essayer la demo" --- zero email, zero mot de passe
3. Une session temporaire est creee avec des donnees realistes
4. Il explore librement : budgets, depenses, enveloppes
5. S'il est convaincu → inscription. Sinon → session expiree en 24h

**Regle d'or** : si la demo ne montre pas clairement "combien il me reste a depenser", l'utilisateur ne comprend pas la proposition de valeur et part.

---

### 2. "Je me lance, je m'inscris"

**Besoin** : aller de zero a un premier budget fonctionnel en moins de 5 minutes.

**Douleurs** : D1, D4

**Scenario** :
1. Inscription (email ou OAuth)
2. Onboarding : "Quel est ton salaire ?"
3. "Quelles sont tes charges fixes ?" (loyer, assurance, tel, transport...)
4. Option d'ajouter des lignes personnalisees
5. Pulpe cree automatiquement un modele "Mois Standard"
6. Le budget du mois en cours est genere
7. Configuration du PIN + cle de secours
8. Redirection vers le dashboard : "Disponible a depenser"

**Point de friction** : l'etape charges fixes. L'utilisateur doit se souvenir de ses montants reels. Les champs pre-remplis (loyer, assurance maladie, telephone, internet, transport) reduisent cette friction.

---

### 3. "Je veux definir mon mois type"

**Besoin** : modeliser sa realite financiere mensuelle une fois, et ne plus y penser.

**Douleurs** : D2

**Scenario** :
1. L'utilisateur ouvre son modele
2. Il gere ses lignes : ajouter, modifier, supprimer
3. Verification de l'equilibre (revenus >= depenses + epargne)
4. Choix de propagation : "appliquer aux budgets futurs" ou "modele uniquement"

**3 types de lignes** :
- **Revenu** --- ce qui entre (salaire, bonus)
- **Depense** --- ce qui sort (loyer, courses)
- **Epargne** --- ce qu'on met de cote (traite comme une depense pour garantir la realisation)

**2 recurrences** :
- **Recurrent** --- chaque mois (salaire, loyer)
- **Prevu** --- ponctuel (cadeau, reparation)

**Protection** : un budget ajuste manuellement n'est jamais ecrase par une propagation.

---

### 4. "Je veux planifier mon annee"

**Besoin** : anticiper 12 mois d'un coup pour avoir une vision globale et arreter de naviguer a vue.

**Douleurs** : D1, D2, D3

**Scenario** :
1. Choisir un modele de reference
2. Choisir la periode (defaut : annee civile)
3. Pulpe genere 12 budgets identiques
4. Les reports se calculent : mois 1 → mois 2 → ... → mois 12
5. Ajuster les mois speciaux (13e salaire en dec, vacances en juillet, impots en mars...)
6. Les reports se recalculent en cascade a chaque ajustement
7. Vision annuelle complete : mois par mois, ce qu'il restera

**Le report : le mecanisme qui change tout.** Sans report, 12 budgets = 12 feuilles independantes. Avec report, c'est une chaine : l'excedent ou le deficit de janvier impacte fevrier, qui impacte mars, etc. C'est *ca* qui permet d'anticiper : "si j'ajoute des vacances en juillet, est-ce que j'ai assez en aout ?"

---

### 5. "Combien je peux depenser aujourd'hui ?"

**Besoin** : le geste quotidien --- ouvrir l'app, voir le chiffre, noter si besoin, fermer. En moins de 10 secondes.

**Douleurs** : D1, D4

**Consulter** :
1. Ouvrir l'app → Face ID / PIN
2. Dashboard : le "hero number" = **Disponible a depenser**
3. Si besoin de details → voir le budget du mois (enveloppes + transactions)
4. Sinon → fermer l'app (< 5 secondes)

**Noter une depense** :
1. Ouvrir l'app → bouton "+"
2. Saisir : montant + nom
3. Rattacher a une enveloppe (ex: "Courses") ou laisser en depense libre
4. Le "Disponible" se met a jour instantanement
5. Pointer maintenant ou plus tard

**Enveloppe allouee** : la depense est "couverte" par sa prevision. Depassement de l'enveloppe = absorbe localement, n'impacte pas les autres.

**Depense libre** : pas rattachee a une enveloppe, reduit directement le "Disponible a depenser". Pour les achats imprevus.

**Pointage** : "Pointe" = j'ai verifie que la depense a bien ete prelevee sur mon compte. Marqueur de reconciliation, pas un prerequis.

---

### 6. "J'ai trop depense ce mois"

**Besoin** : comprendre l'impact d'un depassement et decider quoi faire, sans panique.

**Douleurs** : D1, D3

**Scenario** :
1. Consommation < 80% → rien, tout va bien
2. Consommation 80-100% → signal : "tu approches de ta limite"
3. Consommation > 100% → alerte : "budget depasse"
4. Choix : reduire les depenses, ajuster les previsions, ou ne rien faire
5. Si rien → le depassement devient un **report negatif**
6. Le mois suivant commence en "dette" → "Disponible" reduit

**Le report negatif** : pas de punition, pas de blocage. Un depassement se reporte en dette au mois suivant. L'utilisateur voit l'impact en temps reel sur toute l'annee. Dissuasif sans etre punitif.

---

### 7. "Je veux mettre de l'argent de cote"

**Besoin** : epargner de maniere disciplinee, pas "ce qu'il reste a la fin du mois".

**Douleurs** : D3, D5

**Changement de paradigme** : dans la plupart des apps, l'epargne = "ce qui reste apres les depenses". Resultat : on n'epargne jamais assez. Dans Pulpe, **l'epargne est budgetee comme une depense** --- deduite du disponible des le debut du mois. Ce n'est pas un reste, c'est un engagement.

**Scenario** :
1. Ajouter une ligne de type "Epargne" dans le modele (ex: "Epargne vacances 300.-/mois")
2. L'epargne reduit immediatement le "Disponible a depenser"
3. Chaque mois, faire le virement reellement
4. Enregistrer la transaction et la pointer
5. Suivi : objectif atteint, partiellement atteint, ou a pointer

---

### 8. "Ma situation a change"

**Besoin** : adapter son budget a un changement de vie sans tout reconstruire.

**Douleurs** : D2

**Changement permanent** (augmentation, demenagement, nouvel abonnement) :
1. Modifier le modele (→ Intention 3)
2. Choisir de propager aux budgets futurs
3. Les reports se recalculent en cascade

**Changement temporaire** (13e salaire, reparation voiture, cadeau) :
1. Ajuster uniquement le mois concerne
2. Ce budget est marque "ajuste manuellement"
3. Il ne sera plus ecrase par une propagation future

---

### 9. "Je veux suivre un objectif d'epargne sur plusieurs annees"

**Besoin** : suivre un objectif financier long terme (ex: achat maison sur 48 mois) sans jongler entre deux documents et sans tout recalculer a la main.

**Douleurs** : D3, D5

**Scenario** :
1. Definir un objectif : nom, montant cible, echeance (ex: "Maison, 100'000.-, 48 mois")
2. L'objectif se decompose en montant mensuel planifie
3. Chaque mois, le reel est saisi via la transaction d'epargne (→ Intention 7)
4. L'ecart planifie vs reel est visible instantanement
5. La projection sur les mois restants se recalcule : "au rythme actuel, j'atteins X.- au lieu de Y.-"
6. Si un mois est en dessous du planifie, l'effort est redistribue sur les mois restants
7. Vue d'ensemble : progression, ecart cumule, projection de date d'atteinte

---

### 10. "Je veux comprendre ou va mon argent et comment optimiser"

**Besoin** : avoir des insights intelligents sur ses habitudes de depense et recevoir des suggestions pour mieux gerer son budget.

**Douleurs** : D1, D3

**Scenario** :
1. Apres quelques mois d'utilisation, l'IA analyse les patterns de depenses
2. Identification des postes compressibles ("tu depenses X en Y, la moyenne est Z")
3. Suggestions d'ajustement ("si tu reduis X de 50.-, tu atteins ton objectif maison 2 mois plus tot")
4. Detection des anomalies ("ce mois-ci tu as depense 40% de plus en restaurants")
5. Vue tendancielle : evolution des depenses par categorie sur 6-12 mois

---

### 11. "Mes donnees financieres doivent rester privees"

**Besoin** : avoir la certitude que personne --- meme Pulpe --- ne peut lire mes montants.

**Douleurs** : confiance

**Scenario** :
1. Tous les montants financiers sont chiffres de bout en bout (AES-256-GCM)
2. Le PIN deverrouille la cle de chiffrement, stockee uniquement sur l'appareil
3. La cle de secours est affichee une seule fois, jamais stockee cote serveur
4. Si PIN et cle de secours sont perdus → les donnees financieres sont irrecuperables (zero-knowledge)
5. Le verrouillage automatique (30s en background) protege l'acces physique
6. Face ID / Touch ID comme raccourci de deverrouillage

---

## Frequence des intentions

| Frequence | Intentions |
|-----------|------------|
| **Une fois** | 1. Essayer, 2. S'inscrire |
| **1x / an** | 3. Structurer, 4. Planifier |
| **1x / mois** | 7. Epargner, 8. Changer (si besoin), 9. Suivi objectif long terme |
| **Chaque jour** | 5. Consulter / noter |
| **Quand ca arrive** | 6. Depassement |
| **Continu (passif)** | 10. Insights IA, 11. Securite |

**Le coeur du produit** : 90% du temps passe dans l'app = Intention 5. Tout le reste existe pour que ce moment quotidien de 10 secondes soit possible et fiable.

---

## Chaine de dependances

```
1. Essayer ···(convaincu)···> 2. S'inscrire
                                    │
                                    ├──────────────── 11. Securite (transversal)
                                    ▼
                              3. Structurer ◄──── 8. Changer
                                    │                  ▲
                              ┌─────┤                  │
                              ▼     ▼                  │
                        7. Epargner 4. Planifier        │
                              │     │                  │
                              │     ▼                  │
                              │   5. Consulter / noter  │
                              │     │                  │
                              │     ▼                  │
                              │   6. Depassement ──────┘
                              │
                              ▼
                        9. Objectif long terme
                              │
                              ▼
                        10. Insights IA
```
