# Scrubbing du graphe de la Home

Poser le doigt sur le burn-down de la Home fait apparaître une règle verticale qui suit le doigt, avec une lecture du jour sous la règle : la date, ce qu'il restait réellement ce jour-là, ce que le plan prévoyait, et après aujourd'hui ce que l'estimé donne. Le graphe devient un instrument qu'on interroge, pas une image qu'on regarde. Cible : Maxime et tout utilisateur qui veut savoir « à quel moment le mois a décroché » sans ouvrir le détail.

## What Is Clear

- Déclencheur : appui maintenu court (0,15 s) puis glissement. Le graphe vit dans un `ScrollView` vertical ; un glissement direct volerait le défilement. Retour haptique `.selection` à chaque changement de jour.
- Une seule règle, une seule bulle. La bulle dit : « 12 août · Réel 6'900 CHF · Prévu 7'400 CHF » avant ou le jour J ; « 20 août · Estimé 6'100 CHF · Prévu 7'100 CHF » après. Valeurs plan et estimé interpolées linéairement, réel lu dans `trajectory.real`.
- Les labels fixes (« Aujourd'hui », « Prévu », « Si tu continues ») s'effacent pendant le scrub pour laisser la place à la bulle.
- Montants masqués : le graphe porte déjà `.sensitiveAmount()` ; la bulle hérite du masquage, la date reste.
- VoiceOver ne scrubbe pas : le label du graphe reste la voie accessible. Reduce Motion : la règle suit sans animation.
- La lecture du jour est une fonction pure testée (`scrubReading(at:)`), le geste n'est que de la plomberie.
- Hors périmètre : scrub sur le graphe d'objectif d'épargne ; persistance d'une sélection ; pas d'état partagé avec les tuiles.

## Next Move

Écrire le plan en une phase, l'implémenter, puis le relire.
