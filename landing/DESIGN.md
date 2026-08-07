---
name: Pulpe Landing
description: Une vitrine éditoriale premium qui transforme la planification budgétaire en preuve tangible.
colors:
  primary: "#006E25"
  primary-hover: "#2B883B"
  background: "#F7F6F3"
  surface: "#FFFEFA"
  surface-alt: "#EAF6E6"
  text: "#1A1C19"
  text-secondary: "#454744"
  accent: "#0061A6"
  marker: "#C2F3B5"
  marker-strong: "#AAEC96"
  marker-proof: "#F4DF8A"
  ambient-leaf: "oklch(88% 0.09 145)"
  ambient-mint: "oklch(90% 0.072 164)"
typography:
  display:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 5.6vw, 5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "clamp(2rem, 9vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Poppins, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  card: "16px"
  large: "20px"
  full: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "32px"
  section-mobile: "40px"
  section-desktop: "60px"
  boundary-mobile: "80px"
  boundary-desktop: "120px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "12px 20px"
    height: "48px"
  badge-primary:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  editorial-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.large}"
    padding: "32px"
---

# Design System: Pulpe Landing

> **Hiérarchie documentaire :** [PRODUCT.md](../PRODUCT.md) définit la vérité produit, [DESIGN.md](../DESIGN.md) la direction visuelle commune, ce fichier l'expression marketing Next.js, et [frontend/DESIGN.md](../frontend/DESIGN.md) ainsi que [ios/DESIGN.md](../ios/DESIGN.md) les expériences produit.

## Overview

**Creative North Star: "Un grand bol d'air frais après avoir fermé Excel."**

La landing transforme cette promesse en une publication produit premium : beaucoup d'air, une typographie assurée, des preuves concrètes et des gestes éditoriaux rares. Elle persuade par la clarté de son récit et par la démonstration du produit, jamais par une accumulation de slogans ou d'effets.

La précision suisse reste chaleureuse. Les alignements, contrastes, transitions et états tactiles sont méticuleux, tandis que la palette naturelle et le surligneur feutre empêchent l'ensemble de devenir institutionnel. Le résultat doit paraître fini jusque dans les détails, sans devenir luxueux, brillant ou démonstratif.

**Key Characteristics:**

- Une seule famille, Poppins, modulée par l'échelle, le poids et l'espacement.
- Un champ atmosphérique vert très diffus sur desktop, remplacé par des halos locaux performants sur mobile.
- Un dashboard annuel large comme preuve principale, visible dès le rendu serveur.
- Des surfaces éditoriales plates ou légèrement soulevées, jamais une grille de cartes génériques.
- Un surligneur feutre animé comme signature narrative, toujours décoratif et compatible avec la réduction de mouvement.
- Un CTA dominant par moment de conversion, avec retour tactile précis.

## Colors

La palette repose sur la Forêt Pulpe, une toile chaude et des accents naturels. Les teintes ambiantes créent une atmosphère, mais ne remplacent jamais le contraste des surfaces et du texte.

### Primary

- **Forêt Pulpe** : CTA, progression, liens prioritaires et grands panneaux de plateforme.
- **Forêt vive** : survol du CTA principal sur dispositifs capables de hover.

### Tertiary

- **Lac informatif** : variante de badge et information secondaire ; il ne concurrence jamais le CTA vert.

### Neutral

- **Toile chaude** : fond éditorial continu.
- **Porcelaine chaude** : surfaces et cartes, légèrement teintées plutôt que blanches.
- **Menthe de regroupement** : panneaux positifs et démonstrations calmes.
- **Encre végétale** et **encre secondaire** : texte principal et explications ; aucun gris froid.

### Atmospheric and Editorial Accents

- **Feuille diffuse** et **menthe diffuse** : champs atmosphériques de fond, jamais surfaces de contenu.
- **Surligneur menthe** : emphase narrative standard.
- **Surligneur feuille** : promesse ou phrase décisive.
- **Surligneur preuve** : témoignages authentiques, distincts de la promesse marketing.

### Named Rules

**The Proof Color Rule.** Le jaune doux du surligneur preuve est réservé aux témoignages ; une promesse de marque utilise les verts de la palette.

**The Ambient-not-Surface Rule.** Les teintes `ambient-*` construisent un champ lumineux derrière le contenu. Elles ne deviennent ni fond de carte, ni texte, ni CTA.

**The Contrast-before-Atmosphere Rule.** Un effet ambiant est supprimé ou affaibli dès qu'il dégrade la lisibilité d'un texte, d'une preuve ou d'une action.

## Typography

**Display Font:** Poppins, avec repli système.

**Body Font:** Poppins, avec repli système.

**Character:** La famille unique donne au récit une cohérence éditoriale forte. Les titres deviennent premium par leur rythme serré et leurs lignes équilibrées ; le corps reste généreux, lisible et direct.

### Hierarchy

- **Display** : promesse du héros, échelle fluide jusqu'à `5rem`, graisse 800, interlettrage `-0.04em`.
- **Headline** : titres de sections, échelle fluide jusqu'à `3rem`, graisse 700.
- **Title** : titres des cartes de preuve et plateformes, autour de `1.875rem`, graisse 600.
- **Body** : récit et explications, généralement `1rem` à `1.25rem`, interligne relâché.
- **Label** : navigation, badges et micro-preuves, `0.875rem`, graisse 500–600.

Les titres utilisent `text-wrap: balance` et les paragraphes éditoriaux `text-wrap: pretty`. Les lignes de texte longues restent entre 65 et 75 caractères lorsque la composition le permet. Tous les montants utilisent des chiffres tabulaires.

### Named Rules

**The Single-Family Rule.** Poppins porte tout le landing. La hiérarchie vient de l'échelle et du rythme, jamais d'une seconde police.

**The Editorial Wrap Rule.** Un titre est équilibré et une phrase narrative évite les veuves ; aucune largeur arbitraire ne force une cassure fragile.

## Layout

Le canevas central mesure au maximum `72rem` avec des gouttières de `16px`, `24px` et `32px`. Les sections contribuent chacune la moitié d'une frontière verticale : `40px` sur mobile et `60px` sur desktop, soit un rythme réel de `80px / 120px` entre deux sections ordinaires.

Le héros concentre la promesse, un CTA et la preuve dashboard dans une colonne large. Les sections suivantes alternent texte, démonstrations et compositions asymétriques ; les grilles égales ne sont utilisées que lorsque le contenu est réellement pair, comme les trois témoignages.

Sur desktop, sept gradients radiaux forment un champ continu sur toute la page. Sous `768px`, le fond global disparaît au profit de halos locaux sur le héros et l'ouverture narrative. Ces halos sont dessinés en gradients radiaux superposés plutôt qu'avec un flou coûteux, afin de préserver Safari mobile.

La navigation flotte dans les safe areas. Le CTA persistant apparaît sous `lg` après la sortie du héros et disparaît avant le CTA final ; au-dessus, l'action vit dans la barre de navigation.

### Named Rules

**The Shared Boundary Rule.** Une section apporte la moitié de l'espace qui la sépare de sa voisine ; deux sections ne cumulent jamais deux rythmes complets.

**The Visible Default Rule.** Le contenu marketing et les preuves existent dans le HTML serveur. Le scroll peut embellir un détail, jamais décider si l'information est lisible.

**The Mobile Performance Rule.** Une ambiance visuelle mobile doit rester équivalente sans imposer de grande couche floutée hors écran.

## Elevation & Depth

Le landing reste plat par défaut. Les surfaces se distinguent par leur ton, un filet très léger ou une ombre verte courte. La profondeur est plus forte uniquement pour la capture produit, la barre devenue translucide au scroll et le CTA mobile flottant.

### Shadow Vocabulary

- **Organic** : deux niveaux verts diffus pour les cartes éditoriales qui doivent se détacher du champ ambiant.
- **Screenshot** : profondeur plus nette pour le dashboard, traité comme preuve tangible et non comme carte ordinaire.
- **Glass** : ombre large et légère pour la coque du CTA mobile flottant.
- **Scrolled navigation** : ombre neutre courte sous la barre translucide, active uniquement après le seuil de scroll.

### Named Rules

**The Flat Editorial Rule.** Une carte commence par un ton et un filet. L'ombre organique n'est ajoutée que si la composition exige une séparation réelle.

**The Navigation Glass Rule.** Le backdrop blur appartient à la navigation après scroll. Les cartes de contenu restent opaques.

## Shapes

Les cartes éditoriales emploient `16px`, les grandes preuves et panneaux `20px`, les actions et badges une capsule complète. Les petits contrôles natifs utilisent des angles de `8–12px`. Les formes restent douces mais nettes, sans blobs décoratifs répétés.

Les panneaux imbriqués réduisent leur rayon pour conserver des courbes concentriques. Une carte combine au maximum un filet et une ombre courte ; elle n'empile pas bordure forte, halo et verre.

## Components

### Buttons

- **Primary** : capsule Forêt Pulpe, texte clair, hauteur minimale `48px` et `56px` sur grand desktop.
- **Secondary** : porcelaine chaude, filet d'encre à 10 %, texte principal.
- **Ghost** : texte vert sur fond transparent, soulignement au hover.
- **Inverse** : blanc sur fond vert, réservé aux surfaces primaires.
- L'état pressé réduit l'échelle à `0.96`; le hover desktop monte de `2px` au maximum. La réduction de mouvement supprime ces transformations.

### Navigation

La barre mesure `56px` sur mobile et `72px` sur desktop. Avant scroll elle se fond dans le champ ambiant ; après `20px`, elle devient porcelaine translucide, saturée et floutée. Le menu mobile repose sur `<details>` et un panneau plein écran utilisable sans attendre l'hydratation.

### Badges

Les badges sont des capsules petites et informatives, en vert ou bleu à faible opacité. Ils ne servent ni de titres de section ni de décoration répétitive.

### Editorial Cards

Les cartes associent un récit et une micro-maquette utile. Les panneaux pairs alignent leurs rangées de texte et de preuve avec subgrid ; les surfaces alternent porcelaine et menthe selon le rôle, pas pour créer un damier.

### FAQ

`AccordionItem` utilise `<details>` et `<summary>` natifs. La réponse est présente au rendu serveur, la cible conserve son focus visible, et l'animation de hauteur est supprimée avec `prefers-reduced-motion`.

### Product Proof Dashboard

Le dashboard est la signature visuelle principale : grand montant, prévisions pointables, progression et projection annuelle. Son rayon de `20px`, son ombre screenshot et ses surfaces internes de `14px` le font lire comme un produit réel. Les valeurs sont cohérentes entre elles et la devise s'adapte au visiteur.

### Marker Highlight

Le surligneur feutre suit le texte sans modifier son flux. Il se dessine une fois de gauche à droite lorsque visible ; sans JavaScript ou avec réduction de mouvement, le trait final reste immédiatement présent. Son usage est rare et hiérarchisé par trois couleurs sémantiques.

## Do's and Don'ts

### Do:

- **Do** faire de la démonstration produit la preuve principale du récit.
- **Do** conserver une seule action dominante par moment de conversion.
- **Do** utiliser Poppins, les chiffres tabulaires et des lignes équilibrées sur toute la page.
- **Do** préserver le rendu serveur, les safe areas, le focus visible et la réduction de mouvement.
- **Do** réserver les détails expressifs aux endroits qui racontent quelque chose : surligneur, dashboard, navigation.

### Don't:

- **Don't** cacher une promesse, une preuve ou un témoignage derrière une animation de scroll.
- **Don't** transformer chaque section en grille de cartes égales avec badge et icône.
- **Don't** utiliser de verre, grain, grande ombre noire ou gradient saturé sur les cartes de contenu.
- **Don't** ajouter une deuxième famille typographique ou un thème sombre au landing.
- **Don't** employer le surligneur jaune pour une affirmation marketing non prouvée.
- **Don't** introduire une grande couche floutée sur mobile lorsque des gradients locaux produisent le même résultat.
