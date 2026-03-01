# Pulpe — Principes UX/UI & Biais Cognitifs

> Document vivant. Chaque principe est sourcé scientifiquement et illustré par une décision concrète prise pour Pulpe.
> Dernière mise à jour : 1er mars 2026

---

## Comment utiliser ce document

Ces principes sont des **garde-fous, pas des dogmes**. Aucun n'est un absolu à suivre aveuglément dans 100% des cas.

Chaque principe a un **degré de rigidité** :

- 🔴 **Dur** — Presque toujours vrai. L'enfreindre demande une justification forte et explicite.
- 🟡 **Contextuel** — Vrai dans le contexte où il a été découvert (Pulpe, écran d'accueil, app budget). Peut ne pas s'appliquer sur un autre écran, une autre app, un autre type de donnée.
- 🟢 **Souple** — Bonne pratique par défaut, mais les exceptions sont fréquentes et légitimes.

Le bon designer connaît ces principes pour savoir **quand les suivre ET quand les enfreindre consciemment**. Les enfreindre par ignorance est une erreur. Les enfreindre en connaissance de cause, avec une justification UX claire, est un choix de design valide.

**Exemples d'exceptions légitimes :**
- Un gauge circulaire est adapté pour un objectif à atteindre (Activity Rings Apple), même si la barre est plus "précise" perceptuellement.
- Un élément décoratif sans données (orbes, gradients) peut être justifié par le positionnement émotionnel du produit, même si Tufte dirait de le supprimer.
- Un utilisateur expert qui utilise l'app quotidiennement depuis 6 mois peut absorber plus de 4 chunks grâce au chunking automatique.
- La même donnée à deux endroits différents (widget + écran) est de la redondance voulue si les contextes d'accès sont différents.

---

## 1. Capacité de la mémoire de travail 🟡

### Le principe

La mémoire de travail humaine est limitée à **4 ± 1 chunks** d'information simultanés. Au-delà, le cerveau ne traite plus — il cherche un point d'ancrage familier.

Miller (1956) avait proposé 7 ± 2, mais les travaux de Cowan ont démontré que ce chiffre était surestimé. La vraie limite, quand on empêche le regroupement et la répétition mentale, est d'environ 4.

### Source

- Cowan, N. (2001). "The magical number 4 in short-term memory: A reconsideration of mental storage capacity." *Behavioral and Brain Sciences*, 24(1), 87-114.
- Miller, G.A. (1956). "The magical number seven, plus or minus two." *Psychological Review*, 63, 81-97.

### Application Pulpe

La HeroBalanceCard est passée de 8 éléments à 4 chunks : label contextuel, montant héro, message émotionnel, ratio+barre. Chaque élément retiré (période, icône statut, stats revenus/dépenses/épargne) a été soit déplacé vers la navigation, soit supprimé car redondant.

### Règle à retenir

> **Toute zone d'information critique (hero card, widget, notification) doit contenir au maximum 4-5 éléments distincts.**

---

## 2. Hiérarchie perceptuelle des encodages visuels 🔴

### Le principe

Le cerveau humain ne décode pas tous les encodages visuels avec la même précision. Cleveland & McGill ont établi expérimentalement un classement :

1. **Position sur échelle commune** (le plus précis)
2. **Longueur** (barres)
3. **Angle / Pente**
4. **Surface / Aire**
5. **Volume** (le moins précis)

Une barre horizontale utilise un jugement de longueur (rang 2). Un gauge circulaire utilise un jugement d'angle/arc (rang 3). Les sujets lisent systématiquement les barres avec plus de précision que les gauges ou les pie charts.

### Source

- Cleveland, W.S. & McGill, R. (1984). "Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods." *Journal of the American Statistical Association*, 79, 531-554.
- Cleveland, W.S. & McGill, R. (1986). "An experiment in graphical perception." AT&T Bell Laboratories.

### Application Pulpe

Le gauge circulaire de la HeroBalanceCard V1 a été remplacé par une barre horizontale. Le ratio "Dépensé X sur Y" utilise une position sur échelle commune (rang 1) — le format le plus lisible qui existe.

### Règle à retenir

> **Pour représenter un ratio ou une progression, toujours préférer une barre horizontale à un gauge circulaire, un pie chart ou un donut. La barre est objectivement plus lisible — ce n'est pas une opinion, c'est mesuré.**

---

## 3. Dissonance cognitive stimulus-réponse 🔴

### Le principe

La loi de compatibilité stimulus-réponse impose que le mouvement visuel et l'information textuelle aillent dans le même sens. Quand un élément visuel (une barre qui grandit) contredit un élément textuel (un chiffre qui diminue), le cerveau reçoit deux signaux opposés et doit fournir un effort supplémentaire pour les réconcilier.

Ce phénomène est amplifié quand les deux éléments sont perçus comme un seul objet (loi de l'enclosure en Gestalt) — par exemple, un chiffre au centre d'un cercle qui l'entoure.

### Source

- Fitts, P.M. & Seeger, C.M. (1953). "S-R compatibility: Spatial characteristics of stimulus and response codes." *Journal of Experimental Psychology*, 46(3), 199-210.

### Application Pulpe

Dans la V1, le gauge circulaire entourait le montant disponible. La jauge augmentait (dépenses) tandis que le chiffre diminuait (disponible). Double signal contradictoire, perçu comme un seul objet.

Solution V2 : le montant héro est en haut de la carte, la barre est en bas. La séparation physique (loi de proximité Gestalt) permet au cerveau de traiter les deux comme des informations distinctes. Et le label "Dépensé" au-dessus de la barre prévient le cerveau que l'élément visuel qui suit parle des dépenses, pas du disponible.

### Règle à retenir

> **Si un chiffre et un indicateur visuel évoluent en sens inverse, ils doivent être physiquement séparés et le contexte de l'indicateur visuel doit être explicitement nommé (label).**

---

## 4. Effet de falaise (Cliff Effect) 🟡

### Le principe

Dans le contexte d'une app de budget, si une barre représente le "disponible" et se vide, elle va s'effondrer brutalement en début de mois quand les charges fixes sont prélevées (loyer, assurance, transport). L'utilisateur ouvre l'app le 2 du mois et voit sa barre passer de 100% à ~30% en 24 heures.

C'est un **renforcement négatif** : l'app punit l'utilisateur pour quelque chose qu'il ne contrôle pas (les charges fixes). Pour une app positionnée "Calm Finance", c'est un anti-pattern.

### Source

- Psychologie comportementale : renforcement négatif vs positif (Skinner, B.F.)
- Apple Human Interface Guidelines : les jauges de batterie/stockage représentent des limites, pas des objectifs. Les Activity Rings représentent des objectifs (gamification).

### Application Pulpe

La barre de la HeroBalanceCard représente les **dépenses** (se remplit de gauche à droite) au lieu du disponible (qui se viderait). Combinée au pace indicator, elle transforme la lecture en renforcement positif : tant que la barre est en dessous du trait, l'utilisateur "gagne" — il dépense moins vite que le temps ne passe.

### Règle à retenir

> **Ne jamais représenter le disponible comme une jauge qui se vide quand il y a des prélèvements automatiques en début de mois. Préférer une barre de dépenses qui se remplit, couplée à un repère temporel (pace indicator).**

---

## 5. Data-Ink Ratio 🟢

### Le principe

Le Data-Ink Ratio est la proportion de pixels utilisés pour afficher des données utiles par rapport au nombre total de pixels. Tout pixel qui ne transmet pas d'information mathématique exploitable est du "chartjunk" — il décore sans informer.

### Source

- Tufte, E. (1983). *The Visual Display of Quantitative Information*. Graphics Press.

### Application Pulpe

Les pills Revenus / Dépenses / Épargne sous la hero card contenaient des mini-barres de progression. Ces barres consommaient des pixels sans apporter d'information mathématique claire — le dénominateur (le max) n'était pas visible. L'utilisateur voyait "5'000" avec une barre à 60% sans savoir "60% de quoi".

Les pills ont été supprimées. Les dépenses sont déjà dans le chunk 4 de la hero ("Dépensé X sur Y"). Les revenus sont implicites. L'épargne est une donnée d'analyse, accessible dans l'écran Budgets.

### Règle à retenir

> **Chaque pixel qui représente une donnée doit avoir un dénominateur visible ou implicitement évident. Si l'utilisateur doit se demander "c'est X% de quoi ?", l'élément est inutile ou mal conçu.**

---

## 6. Le dénominateur fantôme 🔴

### Le principe

Une barre de progression représente intrinsèquement une fraction : valeur actuelle / valeur max. Si le max n'est ni visible ni évident, la barre est illisible. Le cerveau voit le remplissage et cherche inconsciemment à quoi correspond le 100%.

Cas typiques de dénominateurs fantômes :
- **Revenus avec barre** : pour un salarié, le revenu est binaire (tombé ou pas). Une barre à 0% ou 100% n'a aucune utilité.
- **Épargne avec barre** : si l'utilisateur n'a pas défini d'objectif d'épargne, le 100% n'existe pas.
- **Dépenses avec barre dans les pills** : si la barre duplique le gauge principal, c'est de la redondance (Loi de Hick).

### Source

- Few, S. (2006). *Information Dashboard Design: The Effective Visual Communication of Data*. O'Reilly.

### Application Pulpe

Les trois pills (Revenus, Dépenses, Épargne) avec mini-barres ont été remplacées par… rien. L'information utile est déjà dans la hero card. L'information d'analyse est dans l'écran Budgets.

### Règle à retenir

> **Ne jamais afficher une barre de progression sans que le dénominateur (le 100%) soit immédiatement compréhensible. Si tu ne peux pas répondre à "c'est quoi le max ?" en une demi-seconde, supprime la barre.**

---

## 7. Loi de Hick (redondance informationnelle) 🟢

### Le principe

Le temps de décision augmente avec le nombre d'options ou de stimuli. Afficher la même donnée deux fois de deux manières différentes au même endroit ne "renforce" pas le message — cela ajoute un stimulus supplémentaire que le cerveau doit traiter et réconcilier.

### Source

- Hick, W.E. (1952). "On the rate of gain of information." *Quarterly Journal of Experimental Psychology*, 4(1), 11-26.
- Hyman, R. (1953). "Stimulus information as a determinant of reaction time." *Journal of Experimental Psychology*, 45(3), 188-196.

### Application Pulpe

La hero card contient "Dépensé 3'006 sur 7'744" avec la barre. Les pills sous la carte affichaient "Dépenses 3'006" avec une mini-barre. C'est la même information, présentée deux fois. Le cerveau doit vérifier que les deux disent la même chose — charge cognitive gratuite.

### Règle à retenir

> **Une donnée = un endroit. Si elle apparaît à deux endroits sur le même écran, c'est une erreur de design, pas un renforcement.**

---

## 8. F-pattern et hiérarchie visuelle mobile 🟢

### Le principe

Sur mobile, les utilisateurs scannent l'écran de haut en bas, avec une attention maximale en haut-gauche. Le premier élément visuel dominant (par taille, contraste ou couleur) capture l'attention. Les éléments suivants sont scannés par ordre de poids visuel décroissant.

### Source

- Nielsen Norman Group (2017). "F-Shaped Pattern of Reading on the Web: Misunderstood, But Still Relevant (Even on Mobile)." Eye-tracking research.
- Interaction Design Foundation. "Visual Hierarchy: Organizing content to follow natural eye movement patterns."

### Application Pulpe

Le montant héro (~42pt, blanc sur fond coloré) est le premier élément que l'œil capte. Le label contextuel au-dessus (petit, opacité réduite) donne le cadre de lecture. Le message émotionnel en dessous guide l'interprétation. La barre en bas donne le contexte quantitatif. L'ordre de lecture est naturel : pas besoin de scanner la carte en Z ou de revenir en arrière.

### Règle à retenir

> **L'information la plus importante doit être le plus gros élément visuel de la zone, positionné en haut. Le contexte (labels, explications) est en plus petit autour.**

---

## 9. Lois de la Gestalt appliquées aux interfaces financières 🔴

### Les principes utiles

- **Proximité** : les éléments proches sont perçus comme liés. Séparer physiquement deux informations aide le cerveau à les traiter indépendamment.
- **Similitude** : les éléments qui se ressemblent (même forme, même couleur, même taille) sont perçus comme faisant partie du même groupe. Donner le même format visuel à des concepts opposés (revenus vs dépenses) force le cerveau à chercher une logique commune inexistante.
- **Enclosure** : les éléments entourés par un même contour sont perçus comme un seul objet. Un chiffre au centre d'un gauge circulaire est perçu comme "une seule chose" — si les deux évoluent en sens inverse, la dissonance est maximale.

### Source

- Wertheimer, M. (1923). "Untersuchungen zur Lehre von der Gestalt." *Psychologische Forschung*, 4, 301-350.

### Application Pulpe

V1 : le gauge circulaire entourait le montant (enclosure) → dissonance maximale. V2 : le montant est en haut, la barre en bas (proximité inversée) → le cerveau les traite séparément. Les pills identiques pour revenus/dépenses/épargne (similitude) forçaient un groupement cognitif incorrect → supprimées.

### Règle à retenir

> **Des concepts qui s'opposent (entrées vs sorties, croissant vs décroissant) ne doivent jamais partager le même format visuel ni être enfermés dans le même contour.**

---

## 10. Budget = limite, pas objectif (modèle mental Apple) 🟡

### Le principe

Apple utilise deux modèles visuels différents pour deux concepts différents :
- **Objectif à atteindre** → anneau qui se remplit (Activity Rings). Psychologie de gamification, sentiment d'accomplissement en "fermant" l'anneau.
- **Limite à ne pas dépasser** → barre linéaire (batterie, stockage). Psychologie de conservation, sentiment de contrôle en "gérant" la ressource.

Un budget est une limite, pas un objectif. On ne veut pas "réussir à tout dépenser". On veut rester dans l'enveloppe.

### Source

- Apple Human Interface Guidelines — Charts & Gauges.

### Application Pulpe

La gauge circulaire évoquait un objectif à atteindre (fermer l'anneau = tout dépenser). La barre horizontale évoque une limite à respecter. Le pace indicator ajoute la dimension temporelle sans changer le modèle mental fondamental.

### Règle à retenir

> **Demande-toi : est-ce que l'utilisateur veut "remplir" cet indicateur ou "ne pas le dépasser" ? Si c'est une limite → barre linéaire. Si c'est un objectif → anneau/cercle.**

---

## 11. Charge cognitive et "Glanceability" 🟡

### Le principe

La charge cognitive (Sweller, 1988) augmente avec le nombre d'éléments à traiter. Dans le contexte d'un dashboard, Smashing Magazine recommande de limiter les éléments visibles à environ 5 pour prévenir la surcharge. Apple utilise le terme "Glanceable" : l'information doit être compréhensible en un regard, sans analyse.

Un dashboard financier n'est pas un tableur. Son rôle est de **répondre à une question** ("combien il me reste ?"), pas de **présenter des données** (revenus, dépenses, épargne, report, pourcentage, jours restants, budget quotidien...).

### Source

- Sweller, J. (1988). "Cognitive Load During Problem Solving." *Cognitive Science*, 12(2), 257-285.
- Smashing Magazine (2025). "From Data To Decisions: UX Strategies For Real-Time Dashboards."

### Application Pulpe

La hero card répond à une seule question : "Combien je peux encore dépenser, et est-ce que je suis dans les temps ?" Tout le reste est de l'analyse, accessible ailleurs.

### Règle à retenir

> **Chaque écran doit répondre à UNE question principale. Si tu dois expliquer comment le lire, c'est trop complexe.**

---

## 12. Liquid Glass — Profondeur sans ombres (iOS 26) 🟡

### Le principe

iOS 26 introduit le Liquid Glass design system. Le principe fondamental : la profondeur se crée par la **translucidité et le blur**, pas par les ombres portées.

- `backdrop-filter: blur()` est le mécanisme principal de profondeur
- Les bordures en `rgba(255,255,255,0.x)` définissent les contours (comme le bord d'un verre qui capte la lumière)
- Les ombres sont réservées aux cas exceptionnels (FAB éventuellement)
- Le Liquid Glass est exclusivement pour la couche de navigation (tab bar, toolbars), jamais pour le contenu

### Source

- Apple WWDC 2025 — Liquid Glass introduction.
- Apple Human Interface Guidelines (2025-2026) — "Liquid Glass is exclusively for the navigation layer that floats above app content."

### Application Pulpe

La hero card utilise un gradient opaque (pas du glass) mais sans ombre portée. La profondeur vient du contraste entre le gradient coloré et le fond ambiant. La tab bar utilise le Liquid Glass natif. Les cartes de contenu sous la hero sont en fond semi-transparent avec blur si nécessaire.

### Règle à retenir

> **Sur iOS 26, ne jamais utiliser de `shadow()` comme mécanisme principal de profondeur. Utiliser le contraste de luminosité, le blur, et les bordures lumineuses.**

---

*Ce document sera enrichi au fil des découvertes UX/UI pendant le développement de Pulpe.*
