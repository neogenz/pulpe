---
objective: "La Home donne une seule projection de fin de mois, une phrase de verdict sans ambiguïté, une casse unique, et deux tuiles qui se lisent comme un seul contrôle."
status: implemented
---

# Plan: Home hero clarity

## Overview

| Field      | Value                   |
| ---------- | ----------------------- |
| **Goal**   | Corriger les défauts de clarté, copie et hiérarchie relevés sur la Home (audit du 2026-08-23, écran iOS `CurrentMonthView`) |
| **Source** | Audit en réponse à Maxime (capture Home, 08:21) : 3 projections concurrentes, -1'114 en doublon, « Sous ton plan » ambigu, registres de copie mélangés, tuile « à pointer » perçue inerte, orange = alerte ET lien |

## Audit → décision

| Défaut | Décision | Phase |
| --- | --- | --- |
| 3 chiffres de fin de mois (estimé 9'533, prévu 10'648, à ce rythme 9'237) au même rang | Trois rôles, trois places : hero = estimé ; règle haute = « Prévu » ; bout du pointillé = « Si tu continues : 9'237 CHF ». Le verbe dit que la tendance est conditionnelle | 1 |
| « -1'114 CHF » imprimé sur la courbe ET dans la tuile Imprévus, orange, traversé par le trait | L'annotation du point redevient « Aujourd'hui » ; la tuile porte seule le montant | 1 |
| « Sous ton plan depuis le 15 août » : sous = bien ou mal ? | Verdict par le verbe : « Tu dépenses plus que prévu depuis le 15 août. » / « Tu dépenses moins que prévu depuis le 15 août. » ; lien « Voir le budget » | 2 |
| Registres mélangés : « estimé fin août », « prévu », « à pointer », « Imprévus » | Sentence case partout (oa-design §Copy) : « Estimé fin août », « Prévu », « À pointer », « Imprévus » | 2 |
| Tuile « 4 à pointer » sans chevron alors qu'elle ouvre la même feuille que sa voisine | Chevron sur les deux tuiles : un contrôle, deux entrées | 3 |
| Orange sur le montant ET sur le lien « Voir le détail » | Le lien prend l'encre du hero (`heroInk`), l'accent reste au montant | 3 |

Hors plan, volontairement : le CTA « Ajouter une opération » reste au-dessus du deck (décision Maxime 2026-08-23) ; le peek latéral du deck (Tour 11, intention) ; le fade du tab bar ; la date d'échéance sous une ligne récurrente (le modèle n'en a pas).

## Palier 2 — refonte recommandée (après check du palier 1)

Preuves : critique impeccable du 2026-08-23 (évaluation B, capture `home.png`) : label -1'114 traversé par la courbe ; valeur dupliquée ; orange sur vert ≈ 4.0-4.5:1 (limite AA, 13 pt) ; « Récurrent » gris ≈ 3.3:1 (échec AA) ; courbe collée au bord gauche ; carte suivante visible sous le tab bar ; « Voir le détail » / « Tout voir » / « Plus tard » sous 44 pt.

| Recommandation | Pourquoi | Phase |
| --- | --- | --- |
| Le graphe montre une trajectoire, pas une chute : base du domaine = plancher explicite sous le minimum (pas « prévu » au bord haut), marge de départ, aire plus discrète | Aujourd'hui un palier au plafond puis un décrochage se lit « rien, puis catastrophe » | 4 |
| Chaque tuile ouvre sa propre chose : « À pointer » défile vers le deck, « Imprévus » ouvre le Réalisé | Deux tuiles dans un seul bouton, deux chevrons au sens différent, un seul résultat : l'utilisateur ne comprend pas ce qu'il vient d'ouvrir | 5 |
| Le deck dit ce qui aide à décider « c'est passé ? » : la date pour un mouvement, « Prévu ce mois » pour une ligne ; indicateur de position « 1/4 » à la place du peek latéral | « Récurrent » est une nature, pas une aide ; le peek lit comme du clipping | 6 |
| Imprévus en orange seulement quand le dépassement n'est pas compensé ; sinon encre + « compensé » | L'orange porte deux sens (alerte et lien) ; un mois qui absorbe son dépassement ne doit pas crier | 7 |
| Contenu jamais sous le tab bar : inset bas + cibles 44 pt sur les liens | Carte et titre « Activité » visibles derrière le flou | 8 |

## Phases

| #   | Phase        | File                         |
| --- | ------------ | ---------------------------- |
| 1   | Une seule projection sur le graphe | [`phase-1.md`](./phase-1.md) |
| 2   | Verdict et casse | [`phase-2.md`](./phase-2.md) |
| 3   | Tuiles et accent | [`phase-3.md`](./phase-3.md) |
| —   | **Palier 1 : check Maxime sur device** | |
| 4   | Remplacée par [`home-burndown-chart`](../2026_08_23_home-burndown-chart/plan.md) (décision Maxime 2026-08-23 : le graphe devient un burn-down du disponible, la règle « Prévu » disparaît) | [`phase-4.md`](./phase-4.md) |
| 5   | Une tuile, une destination | [`phase-5.md`](./phase-5.md) |
| 6   | Deck : dire ce qui aide à décider | [`phase-6.md`](./phase-6.md) |
| 7   | Imprévus sans alarme quand c'est compensé | [`phase-7.md`](./phase-7.md) |
| 8   | Bas d'écran : rien ne se cache sous la barre | [`phase-8.md`](./phase-8.md) |

## Resources

| Source | Verified |
| ------ | ----------------- |
| `.claude/skills/oa-design/_copy.md` | sentence case, un verbe qui dit ce qui se passe, une idée par phrase |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Garder la tendance, chiffrée, relabellisée « Si tu continues : X » | Décision Maxime : la tendance reste. Le conditionnel la distingue de l'estimé ; le point du jour cède son chiffre pour qu'il n'y ait plus qu'une annotation basse |
| Pas de montant dans la phrase de verdict | Le montant vit dans `Imprévus` ; la phrase ne dit que le sens et la date (déjà la règle de `HeroVerdictPresentation`) |
