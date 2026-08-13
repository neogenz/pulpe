---
name: Pulpe Webapp
description: Une application budgétaire calme et précise, où la rigueur suisse reste chaleureuse.
colors:
  primary: "#006E25"
  primary-hover: "#2B883B"
  on-primary: "#FFFFFF"
  secondary: "#406741"
  tertiary: "#0061A6"
  expense: "#B35800"
  warning: "#B8860B"
  critical: "#BA1A1A"
  warm-canvas: "#F7F6F3"
  surface: "#F6FBF1"
  surface-container: "#EAF0E5"
  surface-container-high: "#E5EAE0"
  text: "#181D17"
  text-secondary: "#434841"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "3.5625rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  panel: "16px"
  card: "24px"
  hero: "32px"
  full: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  section-sm: "16px"
  section-md: "24px"
  section-lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "48px"
  search-field:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "56px"
  financial-pill:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  content-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "16px"
---

# Design System: Pulpe Webapp

> **Hiérarchie documentaire :** [PRODUCT.md](../PRODUCT.md) définit la vérité produit, [DESIGN.md](../DESIGN.md) la direction visuelle commune, ce fichier les extensions Angular, et [landing/DESIGN.md](../landing/DESIGN.md) ainsi que [ios/DESIGN.md](../ios/DESIGN.md) les autres plateformes.

## Overview

**Creative North Star: "Un grand bol d'air frais après avoir fermé Excel."**

La webapp traduit cette promesse en précision suisse chaleureuse : une information financière dense mais jamais oppressante, des surfaces calmes et une hiérarchie immédiatement lisible. Le premium vient de l'alignement, de la cohérence des états et du soin des transitions, pas d'une accumulation d'effets.

Angular Material 3 fournit les fondations accessibles et les états natifs. Tailwind v4 compose les interfaces, tandis que les variables `--pulpe-*` portent les notions propres au produit. Cette séparation est structurelle : les fonctionnalités consomment les rôles sémantiques, jamais les détails internes de Material.

**Key Characteristics:**

- Densité opérationnelle maîtrisée, pensée pour le scan quotidien et la planification mensuelle.
- Palette financière sémantique : revenu bleu, dépense ambre, épargne verte, déficit rouge.
- Surfaces Material tonales en usage authentifié ; halo de marque réservé aux parcours d'entrée.
- Manrope pour les titres et montants dominants, DM Sans pour les actions et la lecture.
- Mouvement court, doux et désactivable ; aucune animation nécessaire à la compréhension.

## Colors

La palette combine les graines communes de Pulpe avec une rampe Material 3 réellement générée dans `_theme-colors.scss`. Les couleurs du frontmatter sont les valeurs claires canoniques ; `.dark-theme` remappe leurs rôles sans changer leur sens.

### Primary

- **Forêt Pulpe** : actions principales, épargne, sélection et progression positive.
- **Forêt vive** : état de survol d'une action principale, jamais un second accent décoratif.

### Secondary

- **Sauge structurante** : sélection secondaire, navigation active et regroupements discrets.

### Tertiary

- **Lac informatif** : revenus, liens, informations et contexte de démonstration.

### Neutral

- **Toile chaude** : neutralité commune utilisée lorsque l'expérience doit rester indépendante de la rampe Material.
- **Brume sauge** : surface d'application et niveaux `surface-container-*` de Material ; la variation de ton construit la profondeur sans multiplier les bordures.
- **Encre végétale** : texte principal et secondaire, jamais noir pur.

### Financial States

- **Ambre dépense** : catégorie dépense et dépassement local, avec ses conteneurs clair et sombre.
- **Or de vigilance** : proximité d'une limite ; il avertit sans dramatiser.
- **Rouge critique** : déficit global et erreurs réelles uniquement.

### Named Rules

**The Semantic Color Rule.** Une fonctionnalité utilise `--pulpe-financial-*` ou une classe sémantique associée ; elle ne choisit jamais directement une teinte Material.

**The Rare Red Rule.** Le rouge signale un déficit global ou une erreur réelle. Une dépense ordinaire et un dépassement d'enveloppe restent ambre.

**The Three-Layer Token Rule.** `--mat-sys-*` fonde le thème, Tailwind compose, `--pulpe-*` exprime le domaine. Les fonctionnalités ne lisent pas directement la fondation Material lorsqu'un rôle Pulpe existe.

## Typography

**Display Font:** Manrope, avec repli sans-serif.

**Body Font:** DM Sans, avec repli système.

**Character:** Manrope apporte une présence posée aux titres et aux montants ; DM Sans garde les formulaires, tableaux et libellés ouverts et rapides à lire. Les fontes sont auto-hébergées avec `@fontsource`.

### Hierarchy

- **Display** : grands montants de héros et chiffres de premier niveau, graisse 800 et chiffres tabulaires.
- **Headline** : titres de page et titres de sections majeures, Manrope 700.
- **Title** : cartes, dialogues et groupes fonctionnels, Manrope 600.
- **Body** : explications, formulaires et données secondaires, DM Sans 400–500.
- **Label** : boutons, filtres et métadonnées, DM Sans 600 ; les capitales restent exceptionnelles.

### Named Rules

**The Two-Family Rule.** Manrope porte la hiérarchie de marque ; DM Sans porte l'interface. Aucune troisième famille n'entre dans le chrome.

**The Stable Amount Rule.** Tout montant utilise des chiffres tabulaires et conserve son unité à un niveau visuel secondaire.

## Layout

Le shell adapte son propriétaire de défilement aux breakpoints CDK : défilement du document sur mobile, contenu interne sur desktop. La navigation devient un tiroir complet sur handset et un rail Material compact sur écran large. Le contenu principal repose sur une surface distincte, arrondie sur desktop et bord à bord sur mobile.

Le shell d'entrée centre une seule carte responsive dans la hauteur disponible, avec des gouttières progressives et sans imposer de largeur au composant routé. Les longs formulaires d'onboarding conservent une action primaire sticky ; un fondu supérieur discret révèle qu'il reste du contenu à faire défiler sans masquer les champs.

Les gouttières suivent `16px / 24px / 32px` entre mobile, tablette et desktop. Les espacements de section utilisent la même progression, afin que l'interface gagne en respiration sans changer de rythme. Les pages privilégient une action primaire, placée dans l'en-tête ou dans un FAB lorsque le contexte l'exige.

Les listes financières restent scannables : libellé à gauche, montant aligné à droite, groupes ordonnés et filtres horizontaux défilables sur petits écrans. Les side sheets glissent depuis la droite sur desktop ; les dialogues peuvent devenir plein écran sous `40rem`.

### Named Rules

**The Responsive Ownership Rule.** Le breakpoint Angular et le propriétaire du scroll doivent toujours basculer ensemble ; aucun composant ne recrée sa propre définition du handset.

**The One Primary Action Rule.** Une page présente une seule action remplie dominante. Les actions concurrentes passent en tonal, outlined, texte ou menu.

**The Entry Centering Rule.** Le shell d'entrée centre le composant routé sur les deux axes et lui donne toute la largeur disponible ; la carte enfant fixe seule sa largeur maximale.

**The Scroll Continuity Rule.** Un changement d'étape replace le propriétaire réel du scroll au début du contenu. Une action sticky de formulaire long conserve les safe areas et utilise un fondu supérieur léger comme indice de continuité.

## Elevation & Depth

L'application est tonale par défaut. Les niveaux de surface Material distinguent le canevas, les panneaux et les contrôles ; une bordure subtile suffit aux cartes de données. Les ombres teintées sont réservées aux cartes d'entrée, aux CTA principaux et aux éléments réellement surélevés.

### Shadow Vocabulary

- **Entry ambient** : trois ombres vertes diffuses sur les cartes pré-authentifiées, pour les faire émerger du halo sans effet de boîte générique.
- **Primary action** : relief intérieur léger et ombre verte courte, renforcée au survol avec un déplacement maximal d'un pixel.
- **Material level 2** : héros financier interactif et surfaces dont l'élévation traduit un état.

### Named Rules

**The Tonal-First Rule.** Une différence de niveau commence par une surface Material ; une ombre n'est ajoutée que si l'élément flotte ou répond à une interaction.

## Shapes

Les panneaux fonctionnels utilisent des angles doux de `16px`, les cartes d'entrée `24px` et les héros `32px`. Les actions, filtres, recherches et rails actifs emploient la capsule complète. Les rayons restent concentriques dans les compositions imbriquées.

Les bordures sont fines, continues et sémantiques. Les bandes latérales décoratives, les coins incohérents et les empilements bordure plus grande ombre sont exclus.

## Components

### Buttons

- Les variantes Material 22 sont `filled`, `outlined`, `tonal` et texte ; `pulpe-loading-button` conserve la même géométrie pendant le chargement.
- La hauteur standard est `48px`, avec une cible tactile minimale de `44px`.
- Le CTA principal peut recevoir l'élévation verte dédiée ; au survol il monte d'un pixel, à l'activation il revient au plan.
- Le focus reste celui de Material et le libellé de chargement est annoncé avec `aria-live`.

### Inputs

- Les formulaires structurés utilisent `mat-form-field` outlined, label flottant, aide et erreur dans le même flux.
- La recherche rapide est une capsule de `56px` sur `surface-container-high`, avec effacement accessible.
- Les champs de montant composent valeur, devise et aperçu de conversion sans casser le contrôle du formulaire.
- La création de compte demande le mot de passe une seule fois, avec visibilité, autocomplétion et critères immédiats. La création du PIN conserve une confirmation distincte et rappelle l'identité connectée.

### Chips and Financial Pills

- Les chips Material portent les tags et récurrences ; les Financial Pills utilisent un rôle sémantique de revenu, dépense ou épargne.
- Sur mobile, les pills défilent horizontalement avec snap et fondu latéral ; sur desktop elles se recentrent sans masque.
- Une couleur financière est toujours doublée d'un libellé ou d'une icône.

### Cards

- `FinancialLineCard` est la carte canonique d'une prévision : type, libellé, montant, métadonnées et actions dans cet ordre.
- `StateCard` réunit les états vide, chargement et erreur avec un titre, une explication et au plus une action.
- Les cartes de contenu restent outlined ou tonales ; `mat-card` n'est utilisé que lorsque sa sémantique ou ses états sont utiles.

### Navigation

- Mobile : tiroir Material avec libellé et icône, fermeture après navigation.
- Desktop : rail compact, capsule secondaire pour l'item actif, icône remplie seulement à l'état actif.
- La toolbar reste stable pendant les transitions de page ; seul le contenu principal participe à la View Transition.

### Dashboard Hero

Le héros est la signature opérationnelle : gradient piloté par l'état financier, montant dominant, progression temporelle et texte explicite. L'ensemble est focusable et activable au clavier ; le déficit n'est jamais transmis par la couleur seule.

### Entry and Onboarding

La carte d'entrée reste centrée et stable entre inscription, sécurité et premier budget. Une progression ordonnée à trois étapes distingue clairement terminé, actif et à venir ; ses marqueurs et connecteurs restent centrés, son dernier libellé se raccourcit sur mobile et ses micro-animations disparaissent avec `prefers-reduced-motion`.

Le parcours évite la confirmation mécanique : le mot de passe de compte n'est saisi qu'une fois, tandis que le PIN de chiffrement est confirmé. Sur les étapes longues, le passage à l'étape suivante remonte au début et l'action primaire sticky laisse voir la continuité du contenu.

### Dashboard Check-off Row

Une prévision à pointer reste une ligne de lecture, pas une fausse carte cliquable. Seul le contrôle circulaire de `44px` réagit au survol et au ripple Material ; son vert primaire indique l'action disponible, puis un check confirme localement la réussite. Le montant et son type restent alignés à droite, tandis que l'aide détaillée cède la place à un compteur après le premier pointage.

## Do's and Don'ts

### Do:

- **Do** utiliser les tokens sémantiques Pulpe pour chaque état financier.
- **Do** conserver Manrope pour la hiérarchie et DM Sans pour l'interface.
- **Do** utiliser les mixins `mat.*-overrides()` pour adapter Material.
- **Do** respecter `prefers-reduced-motion` et conserver le contenu final visible sans animation.
- **Do** aligner les montants avec des chiffres tabulaires et des unités discrètes.
- **Do** garder les cartes d'entrée centrées et les marqueurs d'étapes alignés à toutes les largeurs.
- **Do** limiter le feedback interactif du dashboard au contrôle qui déclenche réellement l'action.

### Don't:

- **Don't** utiliser `::ng-deep`, les anciens attributs `mat-flat-button` ou une surcharge CSS globale improvisée.
- **Don't** lire directement `--mat-sys-*` depuis une fonctionnalité lorsqu'un token `--pulpe-*` décrit le besoin.
- **Don't** appliquer du rouge à une dépense ou un dépassement local.
- **Don't** ajouter une ombre à une surface qui peut être hiérarchisée par son ton.
- **Don't** recréer un chip, un état vide ou un bouton de chargement déjà présent dans `app/ui` ou `app/pattern`.
- **Don't** donner un hover de carte à une ligne de dashboard qui n'est pas elle-même cliquable.
- **Don't** dupliquer le champ de mot de passe du compte ; la confirmation reste réservée au PIN de chiffrement.
