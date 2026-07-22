---
target: landing locale vs preview Vercel
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-21T17-40-10Z
slug: landing-app-page-tsx
---
Method: dual-agent (A: `/root/landing_design_review` · B: `/root/landing_detector_evidence`)

## Design Health Score

| # | Heuristique | Score | Point décisif |
|---|---|---:|---|
| 1 | Visibilité de l’état du système | 2/4 | La landing est principalement statique ; peu de retour visible lors du départ vers l’inscription. |
| 2 | Correspondance avec le monde réel | 4/4 | Vocabulaire quotidien, exemples mensuels et promesse de projection immédiatement compréhensibles. |
| 3 | Contrôle et liberté | 3/4 | Navigation par ancres, menu mobile refermable, accordéons et lightbox contrôlables. |
| 4 | Cohérence et standards | 4/4 | CTA, vocabulaire, typographie, couleurs et espacements forment un système stable. |
| 5 | Prévention des erreurs | 3/4 | Peu d’actions risquées et objections importantes clarifiées avant l’inscription. |
| 6 | Reconnaissance plutôt que mémorisation | 4/4 | Mécanisme, plateformes, garanties et FAQ restent visibles et regroupés. |
| 7 | Flexibilité et efficacité | 3/4 | Les ancres et chemins par plateforme couvrent plusieurs intentions sans complexifier la page. |
| 8 | Esthétique et minimalisme | 3/4 | La locale est nettement plus calme que preview ; quelques cadences et traitements SaaS restent génériques. |
| 9 | Diagnostic et récupération après erreur | 2/4 | Aucun état visible ne montre comment récupérer d’un échec de navigation ou de média. |
| 10 | Aide et documentation | 3/4 | FAQ, support, contact, confidentialité et code source sont accessibles, mais peu contextuels. |
| **Total** |  | **31/40** | **Bon : base solide, deux problèmes majeurs de preuve à corriger.** |

## Verdict anti-patterns

### Évaluation visuelle

La version locale présente un risque d’esthétique générée par IA faible à modéré. Elle a supprimé l’essentiel du vocabulaire de landing SaaS générique : pas d’eyebrow marketing, un seul CTA héro, pas de bande de statistiques, pas de cartes flottantes, pas de grille bento ni de roadmap. La promesse temporelle et la preuve produit rendent Pulpe identifiable.

La preview présente un risque modéré à élevé. L’accumulation de « Planifie 12 mois en 3 minutes », deux CTA, cartes métriques flottantes, bande de statistiques, labels verts répétés, modules fonctionnels massifs et roadmap donne un résultat compétent mais plus générique. Elle vend plus fort, mais demande aussi davantage d’attention et affaiblit la sensation de calme.

### Scan déterministe

Le détecteur a trouvé un seul avertissement : `design-system-color` dans `landing/scripts/generate-og-image.ts:45` pour `#F6FFF0`. C’est une dérive documentaire de l’image Open Graph, pas un défaut visible de la page d’accueil. Aucun anti-pattern bloquant n’a été détecté dans les composants de la landing.

### Preuve visuelle

La locale a été vérifiée à 414 px et 1440 px : aucun débordement horizontal, hiérarchie héro stable, section narrative lisible. La preview a été inspectée dans la session authentifiée à largeur desktop. Le rendu mobile de preview n’a pas pu être reproduit de manière fiable ; les conclusions mobiles sur preview reposent donc sur son code responsive.

## Impression générale

La locale est la meilleure base. Elle explique plus vite le bénéfice, réduit le nombre de décisions et rapproche la page de la promesse de Pulpe : voir loin sans stress. La preview possède davantage d’énergie commerciale, mais son surplus de composants transforme progressivement la découverte en évaluation de logiciel.

La plus grosse opportunité n’est pas de reprendre son design. Il faut aligner la preuve produit locale avec la promesse : l’image la plus grande doit montrer le futur, pas principalement « Disponible ce mois » et les dépenses pointées.

## Ce qui fonctionne

1. **Positionnement clair.** « Tu sais des mois à l’avance ce qu’il te restera » différencie Pulpe d’un outil de suivi de transactions dès le premier écran.
2. **Architecture resserrée.** Le parcours promesse → preuve → limites d’Excel et du suivi → mécanisme → témoignages → confiance → objections est plus convaincant que la séquence Features + Roadmap de preview.
3. **Cohérence émotionnelle.** Le fond chaud, le vert utile, le tutoiement et les espaces généreux transmettent mieux le soulagement que la densité de preview.

## Éléments de preview qui valent la peine d’être repris

1. **Le scénario fiscal concret.** « Les impôts tombent. Ton mois ne devrait pas tomber avec. » rend la projection immédiatement tangible. Il faut reprendre l’idée et la conséquence temporelle, pas la carte arrondie ni son décor. Formulation locale possible : « Les impôts tombent en juillet. Tu vois déjà ce qu’il te restera en août. »
2. **La démonstration “mois type → douze mois”.** C’est la meilleure explication du mécanisme unique de Pulpe. Une capture compacte du modèle, ou un recadrage annoté intégré à la section Solution, montrerait pourquoi Pulpe est plus simple qu’Excel.

À ne pas reprendre : l’eyebrow « 12 mois en 3 minutes », le second CTA héro, les cartes flottantes, la bande de statistiques, la grille bento, les kickers répétés et la roadmap.

## Problèmes prioritaires

### [P1] La preuve héro contredit encore la promesse long terme

**Pourquoi :** le plus grand artefact produit met en avant « Disponible ce mois », « Dépensé » et des éléments pointés. En cinq secondes, un visiteur peut encore classer Pulpe parmi les applications de contrôle budgétaire courant.

**Correction :** rendre l’horizon annuel dominant dans le mockup héro. Montrer les mois futurs ou la projection annuelle en premier ; conserver le mois courant comme détail secondaire.

**Commande suggérée :** `$impeccable clarify`

### [P1] La preuve sociale paraît insuffisamment vérifiée

**Pourquoi :** Ismaël apparaît dans le héro puis dans la section témoignages avec deux formulations, tandis que les deux autres citations restent anonymes. Une preuve faible peut créer davantage de doute que l’absence de preuve.

**Correction :** utiliser une seule citation exacte d’Ismaël, une seule fois. Ajouter un contexte honnête aux deux autres citations, ou les retirer tant que leur attribution n’est pas confirmée.

**Commande suggérée :** `$impeccable clarify`

### [P2] Le mécanisme distinctif n’est expliqué qu’en texte

**Pourquoi :** la locale explique « Pose un mois type. Pulpe projette la suite », mais ne montre pas ce mois type. Le visiteur comprend le résultat, pas encore pourquoi cela remplace avantageusement Excel.

**Correction :** intégrer une preuve visuelle compacte du modèle dans Solution ou l’étape 1. Ne pas rétablir toute la section Features de preview.

**Commande suggérée :** `$impeccable layout`

### [P2] La hiérarchie des plateformes divise l’objectif de conversion

**Pourquoi :** la carte iPhone est plus forte que l’accès navigateur alors que le héro dirige vers la création Web. Le visiteur peut hésiter sur le chemin principal.

**Correction :** subordonner les téléchargements à la création du budget ou adapter la priorité au type d’appareil.

**Commande suggérée :** `$impeccable adapt`

### [P3] La cadence de sections devient prévisible

**Pourquoi :** plusieurs blocs répètent grand titre, paragraphe court et composition en colonnes. La page reste claire, mais perd un peu de singularité.

**Correction :** utiliser le scénario fiscal comme un seul temps éditorial différent, sans remettre des cartes et labels partout.

**Commande suggérée :** `$impeccable layout`

## Personas à risque

### Jordan, primo-utilisateur

La promesse et l’absence de connexion bancaire sont claires. Le dashboard mensuel peut toutefois lui faire croire à une application de suivi quotidien. Les témoignages anonymes ne lui donnent pas encore une preuve forte que des personnes comparables utilisent réellement Pulpe.

### Riley, utilisateur méfiant

La gratuité, le chiffrement, le code public et l’absence de connexion bancaire répondent à ses objections. En revanche, la répétition d’Ismaël et les formulations différentes déclenchent un doute d’authenticité. Le détail AES-256-GCM arrive aussi avant une explication simple de ce que Pulpe peut ou ne peut pas voir.

### Casey, visiteur mobile distrait

Le CTA et le menu ont des cibles adaptées, et la locale se scanne mieux que preview. Après le héro, la création du budget disparaît toutefois dans le menu jusqu’au CTA final. La grande preuve produit consomme encore beaucoup de hauteur avant le prochain argument.

### Léa, planificatrice suisse fatiguée d’Excel

Le headline, les impôts et les vacances correspondent à son problème réel. Mais le premier mockup ressemble encore aux outils de suivi qu’elle cherche à quitter. La transformation « mois type → douze mois », potentiellement la raison la plus forte d’abandonner Excel, n’est pas montrée.

## Observations secondaires

- Le screenshot héro combine contour fin et ombre diffuse large, traitement un peu “ghost card” par rapport au système documenté.
- Le CTA final répète davantage la promesse qu’il n’apporte une dernière preuve ou un état final désirable.
- « Montants chiffrés » est compact mais peut être compris comme « exprimés en chiffres » ; « montants protégés par chiffrement » est moins élégant mais plus précis.
- Le contraste des tokens principaux est conforme : texte secondaire sur fond chaud ≈ 5,97:1 ; blanc sur vert ≈ 6,45:1.

## Questions à considérer

- Si Pulpe sert à voir août avant que juillet arrive, pourquoi « Disponible ce mois » reste-t-il le plus grand message produit ?
- Une preuve sociale faible est-elle réellement plus convaincante que le produit lui-même ?
- Une seule image annotée « mois type → douze mois » pourrait-elle remplacer un paragraphe entier et empêcher la confusion avec YNAB ?
- La section plateformes doit-elle informer sur la disponibilité ou diriger immédiatement chaque appareil vers son meilleur prochain geste ?
