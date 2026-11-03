---
status: approved
---

# Mon patrimoine

Une page « Mon patrimoine » pour savoir combien on possède : on déclare ses avoirs (comptes, épargne, placements, cash, objets de valeur, biens) et ses dettes, chacun avec sa valeur et sa devise, et un Sankey montre la répartition de sa fortune aujourd'hui. Pulpe sait déjà où va l'argent du mois ; il ne sait pas ce qui est accumulé.

## Ce qui est clair

- L'usage premier est la photo de sa fortune (« savoir combien j'ai »), pas le pilotage du budget.
- Un avoir porte un libellé libre, une catégorie, une devise (CHF ou EUR), un sens (« ce que j'ai » ou « ce que je dois ») et un marqueur « dans Pulpe ».
- La valeur d'un avoir est une photo datée saisie à la main. L'historique est la suite de ces photos et commence à la création de l'avoir : pas de saisie datée dans le passé.
- Une dette (leasing, crédit, hypothèque) est un avoir de sens « ce que je dois », valorisé par son montant restant dû. La mensualité reste une prévision du budget.
- Le total s'affiche dans la devise de base. Une valeur en autre devise est convertie au taux du jour à l'affichage : exception assumée à la règle du taux figé de `docs/BUSINESS_RULES.md`. La fortune bouge donc avec le change.
- Le Sankey montre la répartition du jour : avoirs → catégories → fortune brute → dettes → fortune nette.
- Les catégories sont créées et nommées librement, sans limite de nombre. Une liste de départ est créée d'office (comptes, épargne, placements, cash, objets de valeur, biens), renommable et supprimable. Pulpe ne s'appuie jamais sur la catégorie : le sens et le marqueur « dans Pulpe » sont des propriétés de l'avoir.
- Le rapprochement pré-remplit les avoirs marqués « dans Pulpe », et les soldes qu'on y tape deviennent de nouvelles photos. Aujourd'hui, les comptes du rapprochement ne sont pas conservés.
- Deux étapes, toutes deux dans le périmètre, dans cet ordre :
  1. Avoirs, dettes, catégories, photos datées, Sankey du jour, branchement au rapprochement.
  2. Branchements « cible d'épargne » (une prévision Épargne alimente un avoir) et « source de revenu » (un revenu est tiré d'un avoir), avec des suggestions de valeur : une épargne pointée ajoute son montant, un revenu pointé tiré d'un avoir le retire, une dépense ne compte jamais. Accepter crée une photo ; écarter masque la suggestion jusqu'au prochain mouvement lié.
- Web uniquement dans un premier temps.

## Hypothèses

- C'est d'abord pour l'usage de Maxime ; non corrigé pendant l'échange.
- Pas de bouton de bascule CHF/EUR sur la page : la devise de base suffit.
- Une mensualité de dette pointée propose le nouveau restant dû, avec le même mécanisme de suggestion, en étape 2.
- Les placements (3a, LPP, actions, crypto) sont des avoirs valorisés à la main, sans cours de marché.
- Pas de vue d'évolution en étape 1 : un sélecteur de date sur le Sankey viendra quand l'historique existera.

## Encore ouvert

- Objectifs d'épargne : un objectif porte-t-il son avoir une fois pour toutes, ou choisit-on l'avoir sur chaque prévision Épargne ? (étape 2)
- « Source de revenu » doit s'accorder avec l'interrupteur existant « Cet argent vient de mon épargne » (`aidd_docs/tasks/2026_10/2026_10_20_revenue-origin-switch/`). (étape 2)
- Que deviennent les avoirs d'une catégorie supprimée ?
- Un avoir vendu ou supprimé : son historique disparaît-il, ou reste-t-il dans les photos passées ?
- Après un rejet, la suggestion suivante inclut-elle le mouvement écarté ?
- Où vit la page dans la navigation web.
