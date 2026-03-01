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

---

## 13. Loi de Fitts — Taille et distance des cibles tactiles 🔴

### Le principe

Le temps nécessaire pour atteindre une cible est une fonction de la **distance** jusqu'à la cible et de la **taille** de la cible. Plus c'est gros et proche, plus c'est rapide. Plus c'est petit et loin, plus c'est lent et source d'erreurs.

C'est l'une des lois les plus robustes de l'interaction homme-machine, vérifiée sur des doigts, des souris, des pieds, des yeux, sous l'eau, avec des populations jeunes, âgées, et en situation de handicap.

Sur mobile, les doigts sont plus épais et moins précis qu'un curseur. Apple impose un minimum de **44×44 pt** pour les zones tactiles. Google Material Design impose **48×48 dp**. Les recherches du MIT Touch Lab ont mesuré que la zone de sensibilité de la pulpe du doigt est de 8-10 mm, ce qui correspond à ces minimums.

### Source

- Fitts, P.M. (1954). "The information capacity of the human motor system in controlling the amplitude of movement." *Journal of Experimental Psychology*, 47(6), 381-391.
- Apple Human Interface Guidelines — Touch targets minimum 44×44 pt.
- Google Material Design 3 — Touch targets minimum 48×48 dp.
- MIT Touch Lab — Fingertip sensitivity range 8-10 mm.
- Nielsen Norman Group (2024). "Fitts's Law and Its Applications in UX."

### Application Pulpe

Les boutons d'action principaux (valider une transaction, naviguer entre mois) doivent respecter 44×44 pt minimum. Le bouton sur la hero card (si on en ajoute un, comme "voir détail") doit être facilement atteignable au pouce — idéalement dans la moitié basse de l'écran, dans la zone de confort du pouce.

### Règle à retenir

> **Toute zone interactive doit mesurer au minimum 44×44 pt (iOS) / 48×48 dp (Android). Les actions fréquentes doivent être dans la zone de confort du pouce (moitié basse de l'écran). C'est non négociable pour l'accessibilité.**

---

## 14. Loi de Jakob — Les utilisateurs préfèrent ce qu'ils connaissent 🔴

### Le principe

Les utilisateurs passent la majorité de leur temps sur **d'autres apps** que la tienne. Ils s'attendent donc à ce que ton app fonctionne comme celles qu'ils connaissent déjà. Quand tu dévies d'un pattern familier, l'utilisateur doit investir de l'énergie cognitive pour apprendre le nouveau pattern — et la plupart ne le feront pas.

Les modèles mentaux des utilisateurs se construisent lentement, par répétition de patterns communs à travers des dizaines d'apps. Chaque app individuelle n'est qu'un grain de sable dans cette expérience globale.

Même si un nouveau design est hypothétiquement 10% meilleur que le standard, les utilisateurs ne l'adopteront pas si ça leur coûte 20% d'effort d'apprentissage les premières fois.

### Source

- Nielsen, J. (2000). "End of Web Design." *Nielsen Norman Group*.
- Laws of UX — Jakob's Law.
- Nielsen Norman Group (2024). "Mental Models and User Experience Design."
- Données citées : la cohérence de design entre plateformes peut améliorer la rétention de 20-30%.

### Application Pulpe

La navigation bottom tab (Accueil, Budgets, Paramètres) suit le pattern iOS standard. Les gestes (swipe pour naviguer entre mois, pull-to-refresh) respectent les conventions Apple. Le format CHF avec apostrophe (3'006) suit la convention suisse, pas le format international (3,006).

### Règle à retenir

> **Avant d'inventer un pattern custom, vérifie comment les 5 apps les plus utilisées par ta cible résolvent le même problème. Si un standard existe et fonctionne, utilise-le. L'innovation se fait dans la valeur du contenu, pas dans la réinvention des contrôles.**

---

## 15. Effet esthétique-utilisabilité (Aesthetic-Usability Effect) 🔴

### Le principe

Les utilisateurs perçoivent les interfaces visuellement belles comme **plus faciles à utiliser**, même quand elles ne le sont pas objectivement. C'est un effet de halo : le cerveau généralise une impression positive (c'est beau) vers d'autres attributs (c'est fiable, c'est bien conçu, c'est facile).

Les interfaces esthétiques rendent les utilisateurs **plus tolérants** aux problèmes mineurs d'utilisabilité. Ils pardonnent plus facilement un bug ou un flow imparfait si l'app est belle. En revanche, cet effet a ses limites : il ne compense pas les problèmes graves (navigation cassée, données illisibles).

Sonderegger & Sauer (2010) ont montré que les utilisateurs d'un prototype esthétique ont non seulement noté l'app comme plus utilisable, mais ont aussi **performé objectivement mieux** (tâches plus rapides, moins d'erreurs). L'esthétique crée une forme de flow state qui améliore réellement la performance.

### Source

- Kurosu, M. & Kashimura, K. (1995). "Apparent Usability vs. Inherent Usability." *Hitachi Design Center*. 252 participants, 26 variantes d'interface ATM.
- Norman, D. (2004). *Emotional Design: Why We Love (or Hate) Everyday Things*. Basic Books.
- Sonderegger, A. & Sauer, J. (2010). "The influence of design aesthetics in usability testing." Effet positif sur performance réelle, pas seulement perçue.
- Tuch, A.N. et al. (2012). Effet esthétique confirmé mais réversible sous certaines conditions.
- Nielsen Norman Group (2024). "The Aesthetic-Usability Effect."
- Laws of UX — Aesthetic-Usability Effect.

### Application Pulpe

Les orbes décoratives, les gradients soignés, les animations spring sur la hero card, le choix typographique (Poppins + JetBrains Mono) — tout cela n'est pas du "chartjunk" au sens de Tufte. C'est un investissement mesurable dans la perception de qualité et de fiabilité. Pour une app de finance, la confiance visuelle est critique : une app financière qui "a l'air cheap" ne sera pas utilisée, même si elle est fonctionnelle.

### Règle à retenir

> **Investir dans l'esthétique n'est pas du luxe — c'est un multiplicateur d'utilisabilité perçue. Mais l'esthétique ne rattrape pas une UX cassée. Belle ET utilisable, pas belle OU utilisable.**

---

## 16. Ratio de contraste — Accessibilité universelle 🔴

### Le principe

Le contraste entre le texte et son fond doit atteindre un ratio minimum pour être lisible par tous, y compris les personnes malvoyantes, les écrans de mauvaise qualité, et l'utilisation en plein soleil.

Les WCAG (Web Content Accessibility Guidelines) définissent deux niveaux :
- **Texte normal** : ratio minimum **4.5:1** (niveau AA)
- **Grand texte** (≥18pt regular ou ≥14pt bold) : ratio minimum **3:1**
- **Éléments interactifs** (boutons, icônes) : ratio minimum **3:1** contre le fond adjacent

Google Material Design 3 et Apple HIG suivent ces standards. Google utilise un système de tonalité (tonal palette) où les combinaisons de couleurs sont algorithmiquement garanties accessibles.

### Source

- W3C WCAG 2.1, Success Criterion 1.4.3 (niveau AA) et 1.4.6 (niveau AAA).
- Google Material Design 3 — Color & Accessibility, contrast checking intégré.
- Apple Human Interface Guidelines — Accessibility, Dynamic Type.
- Google Design (2018). "Designing For Global Accessibility, Part III." — 4.5:1 pour le texte normal, 3:1 pour le grand texte.

### Application Pulpe

Le montant héro (blanc sur gradient vert foncé) doit maintenir un ratio ≥ 3:1 (grand texte bold). Le label "DISPONIBLE" en blanc 55% d'opacité sur le même fond doit être vérifié — une opacité trop faible peut échouer en accessibilité. Les messages émotionnels (blanc 70%) doivent aussi être vérifiés. En état déficit (gradient rouge), le texte blanc doit maintenir le ratio.

### Règle à retenir

> **Vérifie systématiquement le ratio de contraste de TOUT texte sur TOUT fond avec un outil (Stark, Colour Contrast Analyzer). Ce n'est pas un "nice to have" — c'est une obligation légale dans l'UE et un critère de rejet App Store.**

---

## 17. Seuil de Doherty — La réactivité crée l'engagement 🟡

### Le principe

Quand le système répond en **moins de 400 ms**, les utilisateurs perçoivent l'interaction comme fluide et maintiennent leur attention. Au-delà de 400 ms, l'attention commence à décrocher. Au-delà de 1 seconde, l'utilisateur perd le sentiment de contrôle direct.

Ce seuil a été formalisé par Walter Doherty (IBM, 1982) qui a démontré que réduire le temps de réponse sous 400 ms augmentait la productivité de manière significative ET addictive — les utilisateurs devenaient plus engagés, pas seulement plus efficaces.

Nielsen (1993) a raffiné en trois paliers :
- **0.1s** : l'utilisateur perçoit une réponse instantanée
- **1.0s** : limite pour maintenir le flux de pensée
- **10s** : limite pour maintenir l'attention

### Source

- Doherty, W.J. & Kelisky, R.P. (1979). "Managing VM/CMS Systems for User Effectiveness." *IBM Systems Journal*, 18(1).
- Nielsen, J. (1993). *Usability Engineering*. Academic Press. — Les trois paliers de temps de réponse.
- Laws of UX — Doherty Threshold.
- Nielsen Norman Group — "Every 100ms of interface lag can halve task success rates."

### Application Pulpe

Les transitions entre les 3 états de la hero card (vert → ambre → rouge) doivent se faire en spring animation ~0.7s — assez rapide pour sembler réactif, assez lent pour être perçu consciemment (pas instantané, ce qui serait brutal). Le changement de mois (swipe) doit recharger les données et mettre à jour l'affichage en moins de 400 ms.

### Règle à retenir

> **Toute interaction utilisateur doit produire un feedback visuel en moins de 100 ms (même si les données mettent plus longtemps à charger). Utilise des animations et des skeleton screens pour combler le vide.**

---

## 18. Effet Von Restorff — L'élément différent est mémorisé 🟢

### Le principe

Aussi appelé "effet d'isolation" : quand plusieurs éléments similaires sont présentés ensemble, celui qui **diffère** le plus des autres est le mieux mémorisé. Le cerveau accorde plus d'attention et de mémoire à l'exception qu'à la norme.

Ce principe est utilisé pour attirer l'attention sur les call-to-action, les alertes, et les informations critiques en les rendant visuellement distincts de leur environnement.

### Source

- Von Restorff, H. (1933). "Über die Wirkung von Bereichsbildungen im Spurenfeld." *Psychologische Forschung*, 18, 299-342.
- Laws of UX — Von Restorff Effect.

### Application Pulpe

Le montant héro (42pt, blanc, bold) sur la hero card est l'élément Von Restorff : il est massivement plus gros que tout le reste de l'écran. De même, quand l'état passe en déficit (fond rouge), le changement de couleur exploite l'effet d'isolation — le rouge parmi les verts/neutres du reste de l'interface attire immédiatement l'attention.

### Règle à retenir

> **Un seul élément par écran doit être visuellement "différent" des autres. Si tout est mis en avant, rien n'est mis en avant. Choisis UNE chose à rendre saillante.**

---

## 19. Loi de Tesler — La complexité incompressible 🟡

### Le principe

Chaque système a un niveau de complexité incompressible qui ne peut pas être éliminé. La seule question est : **qui la porte** — l'utilisateur ou le système ?

Si tu simplifies trop l'interface en cachant des options nécessaires, l'utilisateur devra fournir un effort supplémentaire pour les trouver ou les contourner. Le bon design absorbe la complexité côté système pour que l'utilisateur n'ait pas à y penser.

### Source

- Tesler, L. (années 1980). Vice-président Apple, Xerox PARC. Formulé comme "Law of Conservation of Complexity."
- Laws of UX — Tesler's Law.

### Application Pulpe

Le système de templates qui génère automatiquement les budgets mensuels absorbe la complexité de la planification (l'utilisateur ne crée pas chaque ligne chaque mois). Le calcul de l'available (revenus + report) est automatique — l'utilisateur voit le résultat, pas la formule. Le pace indicator se calcule automatiquement à partir de la date — l'utilisateur n'a rien à configurer.

### Règle à retenir

> **Quand tu veux "simplifier", demande-toi : est-ce que je supprime de la complexité ou est-ce que je la déplace vers l'utilisateur ? Si l'utilisateur doit maintenant faire un calcul mental ou chercher une option cachée, tu n'as rien simplifié.**

---

## 20. Peak-End Rule — L'expérience se juge sur le pic et la fin 🟢

### Le principe

Les gens jugent une expérience principalement sur ce qu'ils ont ressenti **au moment le plus intense** (pic) et **à la fin**, pas sur la moyenne de l'expérience. C'est contre-intuitif : une session longue et moyennement agréable sera moins bien notée qu'une session courte avec un moment fort positif et une fin agréable.

### Source

- Kahneman, D. et al. (1993). "When More Pain Is Preferred to Less: Adding a Better End." *Psychological Science*, 4(6), 401-405.
- Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux.
- Laws of UX — Peak-End Rule.

### Application Pulpe

Le "pic" de Pulpe, c'est le message émotionnel de la hero card ("Belle marge ce mois" / "Serré — mais tu le sais"). C'est le moment de soulagement ou de prise de conscience en douceur. La "fin" de session, c'est quand l'utilisateur ferme l'app après avoir vérifié son budget — il doit partir avec un sentiment de contrôle, pas d'anxiété. Même en déficit, "Ça arrive — on gère" laisse une impression de maîtrise.

### Règle à retenir

> **Soigne les deux moments qui comptent le plus : le pic émotionnel (première info vue) et la dernière impression. Si l'utilisateur ferme l'app en se sentant en contrôle, l'expérience est réussie — même si des micro-frictions ont existé en cours de route.**

---

## 21. Progressive Disclosure — Révéler au bon moment 🔴

### Le principe

Ne jamais tout montrer d'un coup. Présenter d'abord l'essentiel, puis révéler la complexité au fur et à mesure que l'utilisateur progresse ou en a besoin. Les fonctionnalités avancées ou rarement utilisées sont déférées à des écrans secondaires.

Jakob Nielsen a introduit ce pattern en 1995 pour réduire les erreurs dans les applications complexes. Le Baymard Institute a mesuré que **18% des utilisateurs abandonnent** un processus (commande, inscription) parce qu'il est trop long ou compliqué. La progressive disclosure combat directement ce problème.

Apple l'utilise systématiquement : l'onboarding d'un iPhone présente une seule question par écran. Slack et Duolingo commencent avec une interface minimale et révèlent les fonctionnalités avancées au fil de l'usage.

### Source

- Nielsen, J. (2006). "Progressive Disclosure." *Nielsen Norman Group*.
- Baymard Institute — 18% d'abandon dû à la complexité.
- NN/g (2025). "4 Principles to Reduce Cognitive Load in Forms" — Pattern "one thing per page" (GOV.UK).
- Apple Human Interface Guidelines — Onboarding step-by-step.

### Application Pulpe

L'onboarding de Pulpe en 9 étapes utilise exactement ce principe : chaque écran pose une seule question (revenus, logement, assurance, transport). L'écran d'accueil ne montre que la hero card + transactions récentes. Le détail des enveloppes budgétaires n'apparaît que dans l'écran Budgets. Les settings avancés (encryption vault, export) sont dans un niveau de profondeur supplémentaire.

### Règle à retenir

> **Montre le minimum nécessaire à chaque étape. Si un utilisateur doit scroller pour comprendre où commencer, tu montres trop. La complexité doit être accessible sur demande, pas imposée d'emblée.**

---

## 22. Micro-interactions — Le feedback invisible 🟢

### Le principe

Les micro-interactions sont de petites animations ou réponses visuelles qui confirment une action, guident l'utilisateur, ou ajoutent du plaisir à l'usage. Elles sont le mécanisme fondamental de **feedback** du système : sans elles, l'utilisateur ne sait pas si son action a été prise en compte.

NN/g a montré que les micro-interactions améliorent l'engagement et le flow de navigation. Mais elles doivent être **invisibles** quand elles fonctionnent bien — si l'utilisateur les remarque consciemment, elles sont probablement trop flashy ou trop lentes.

Types de micro-interactions essentielles : indicateurs de statut (loading, succès), feedback de toucher (bounce, highlight), guidance contextuelle (tooltip au bon moment), et renforcement d'action (checkmark après validation).

### Source

- Saffer, D. (2013). *Microinteractions: Designing with Details*. O'Reilly.
- Nielsen Norman Group — Micro-interactions improve engagement and navigation flow.
- Apple HIG — Haptic Feedback (UIImpactFeedbackGenerator). Le feedback tactile améliore la précision de complétion des tâches de ~18%.

### Application Pulpe

La transition de couleur de la hero card (vert → ambre → rouge) est une micro-interaction. L'animation spring de la barre de dépenses quand elle se met à jour est une micro-interaction. Le bounce subtil quand l'utilisateur valide une transaction est une micro-interaction. Aucune de ces animations ne doit être consciente — elles doivent juste rendre l'app "vivante".

### Règle à retenir

> **Chaque action utilisateur doit produire un feedback visuel ou tactile immédiat. Mais si l'utilisateur remarque l'animation, elle est trop présente. Les meilleures micro-interactions sont celles qu'on ne remarque que quand elles disparaissent.**

---

## 23. Écriture UX — Les mots sont du design 🟡

### Le principe

L'étude classique de NN/g a mesuré que les pages web réécrites de manière concise et formatées pour le scan améliorent l'utilisabilité de **58%**. Quand on combine la concision avec un langage objectif (neutre), l'utilisabilité monte à **+124%**.

Les utilisateurs ne lisent pas — ils scannent. Le texte d'interface (microcopy) doit être chargé d'information en front-loading : le mot le plus important en premier. Les labels doivent être concrets et spécifiques, pas vagues et génériques. "Dépensé 3'006 sur 7'744" est meilleur que "Progression budgétaire : 39%".

Le ton communique la personnalité et influence la confiance. NN/g identifie 4 dimensions : humour, formalité, respect, et enthousiasme.

### Source

- Nielsen, J. (1997). "How Users Read on the Web." *Nielsen Norman Group*. — +58% concis, +124% concis+neutre+scannable.
- NN/g — 4 dimensions de ton (humour, formalité, respect, enthousiasme).
- Wood, B. — "Microcopy is only the confetti sprinkled on a larger narrative."

### Application Pulpe

Les messages émotionnels de la hero card ("Belle marge ce mois", "Serré — mais tu le sais", "Ça arrive — on gère") sont du microcopy calibré sur le ton Pulpe : informel, respectueux, zéro jargon financier. Le label "Dépensé 3'006 sur 7'744" front-loade le verbe d'action (Dépensé) avant les chiffres. Le label "DISPONIBLE" est un seul mot sans ambiguïté.

### Règle à retenir

> **Chaque mot d'interface est un choix de design. Front-loade l'information clé (verbe ou chiffre en premier). Coupe tout mot qui n'aide pas l'utilisateur à agir ou comprendre. Teste le texte avec de vrais utilisateurs — le microcopy est la partie la plus souvent sous-estimée et la plus facile à améliorer.**

---

## 24. Serial Position Effect — Premier et dernier éléments mémorisés 🟢

### Le principe

Dans une liste d'éléments, les gens retiennent mieux le **premier** (effet de primauté) et le **dernier** (effet de récence). Les éléments au milieu sont oubliés. C'est mesuré depuis les travaux de Hermann Ebbinghaus (1885) et confirmé par des décennies de recherche en mémoire.

En UX, ça signifie que les actions les plus importantes doivent être placées en premier ou en dernier dans une liste, un menu, ou une navigation.

### Source

- Ebbinghaus, H. (1885). *Über das Gedächtnis* (On Memory).
- Murdock, B.B. (1962). "The serial position effect of free recall." *Journal of Experimental Psychology*, 64(5), 482-488.
- Laws of UX — Serial Position Effect.

### Application Pulpe

Dans la bottom tab bar (3 onglets), "Accueil" est en première position et "Paramètres" en dernière. "Budgets" est au milieu — c'est normal car c'est un onglet d'analyse, pas d'action quotidienne. Dans les listes de transactions, les transactions les plus récentes sont en haut (effet de récence — l'utilisateur veut vérifier les dernières actions).

### Règle à retenir

> **Place l'action la plus importante en première ou dernière position d'une liste/navigation. Ne mets jamais l'élément critique au milieu — c'est la "zone morte" de la mémoire.**

---

## 25. Effet Zeigarnik — L'inachevé crée de l'engagement 🟢

### Le principe

Les tâches inachevées occupent plus d'espace mental que les tâches terminées. Le cerveau continue de "travailler" sur une tâche non terminée en arrière-plan, créant une tension qui motive la complétion. C'est pourquoi les barres de progression et les indicateurs "3 sur 5 étapes" sont si efficaces.

Mais attention : dans le contexte d'une app "Calm Finance", l'effet Zeigarnik peut être anxiogène s'il est mal utilisé. Une barre de progression qui dit "tu n'as pas fini" peut stresser au lieu de motiver. L'astuce est de l'utiliser pour les actions positives (compléter l'onboarding, valider ses transactions) et jamais pour les métriques négatives (dépenses non contrôlées).

### Source

- Zeigarnik, B. (1927). "Über das Behalten von erledigten und unerledigten Handlungen." *Psychologische Forschung*, 9, 1-85.
- Laws of UX — Zeigarnik Effect.

### Application Pulpe

L'onboarding en 9 étapes avec barre de progression utilise l'effet Zeigarnik positivement : l'utilisateur veut "fermer" la progression. Le pace indicator dans la hero card exploite subtilement cet effet : la barre de dépenses n'est "pas encore au trait" — l'utilisateur est motivé à garder ce statut. Mais Pulpe n'utilise PAS l'effet Zeigarnik négativement — pas de notifications "tu n'as pas vérifié tes comptes depuis 3 jours".

### Règle à retenir

> **Utilise l'inachevé pour motiver la complétion d'actions positives (onboarding, validation). Ne l'utilise jamais pour culpabiliser ou stresser. La différence entre gamification et manipulation est l'intention derrière l'effet.**

---

*Ce document sera enrichi au fil des découvertes UX/UI pendant le développement de Pulpe.*
