Je vais examiner attentivement chaque écran pour te faire une review UX/UI complète et actionnable.

Avant de plonger dans l'analyse, laisse-moi regarder les screenshots de plus près et consulter le contexte du projet.Maintenant j'ai une vue complète de ton design system et de tes écrans. Voici ma review détaillée.

---

## Review UX/UI — Pulpe iOS v1.0.0

### Diagnostic global

Tu as trois problèmes structurels qui irradient sur presque tous les écrans :

**1. Le fond vert dégradé entre en compétition avec le contenu.** Le background `#F6FFF0`-ish avec le dégradé vert subtil crée un "bruit" visuel permanent. Les cartes blanches flottent sur un fond qui n'est ni assez neutre pour disparaître, ni assez affirmé pour être un vrai choix esthétique. Résultat : tout semble un peu sale, un peu "lavé". Sur l'écran déficit (Image 11), le fond passe au doré/ocre et là c'est encore pire — le mélange vert + orange + blanc crée une cacophonie.

**2. Trop de niveaux visuels sans hiérarchie claire.** Sur le budget mensuel (Image 5), tu as : fond dégradé → carte verte hero → pills résumé → carte report jaune → section Revenus → carte swipeable → lignes individuelles. Ça fait 6-7 niveaux d'emboîtement. L'œil ne sait pas où se poser. Chaque élément crie "regarde-moi" et aucun ne gagne.

**3. Les couleurs financières ne forment pas un système cohérent.** Tu as du bleu pour revenus (icônes), du vert pour les montants positifs, de l'orange pour les dépenses, du vert foncé pour la hero card, du doré/ocre pour le déficit... Les couleurs semblent choisies individuellement plutôt que comme un système. Le vert fait triple emploi : marque, positif, et fond.

---

### Écran par écran

**Écran PIN (Image 20)** — C'est ton meilleur écran. Le fond dégradé vert fonctionne ici parce qu'il n'y a pas de contenu dense à lire. Le logo est bien centré, le pavé numérique est lisible. Seul souci : les boutons du pavé sont un peu "flat" et pourraient bénéficier d'un léger relief pour le feedback tactile.

**Accueil (Images 19, 15)** — La hero card fonctionne émotionnellement : "Déficit ce mois — 223.99 — Ce mois sera serré, mais tu le sais" c'est excellent en termes de tone of voice. Mais visuellement, la carte ocre sur fond vert-gris, puis les pills Revenus/Dépenses/Épargne dans des couleurs différentes, puis la section Projection, puis Aperçu, puis Transactions récentes... c'est un scroll sans fin sans respiration. La bottom sheet "Suivi du budget" (Image 15) est propre mais déconnectée visuellement du reste.

**Budget mensuel (Images 5, 10, 7)** — L'écran le plus chargé. Le segment "À pointer / Toutes" en haut est bien, mais en dessous, la carte verte hero avec le cercle de pourcentage, les 3 pills, le report, les Revenus avec le swipe action, les lignes... Le swipe action avec "Comptabiliser" et "Supprimer" (Image 5) ajoute des couleurs supplémentaires (bleu, orange) à un écran déjà saturé. Le "+" bleu au bout de chaque ligne n'est pas assez différencié du "+" vert en haut à droite.

**Le sélecteur de mois (Image 4)** — Le dropdown natif fonctionne mais il cache tout le contenu en dessous. Un scroll horizontal de mois (comme beaucoup d'apps finance) serait plus fluide et permettrait de garder le contexte.

**Bottom sheet détail de ligne (Image 6)** — C'est bien structuré : Dépensé / Prévu / Reste avec la barre de progression. Mais les 3 mini-cards utilisent 3 couleurs différentes (orange, gris, bleu) sans raison sémantique claire. Et le bouton "Nouvelle transaction" vert plein en bas est le seul bouton de ce style dans toute l'app, ce qui crée une incohérence.

**Ajout de transaction (Image 8)** — Les quick amounts (10/15/20/30 CHF) en chips orangés sont une bonne idée UX. Mais le champ description et le champ date sont visuellement identiques alors qu'ils ont des interactions très différentes. Le bouton "Ajouter" est gris/inactif et ne ressemble pas au CTA vert qu'on voit ailleurs.

**Formulaires Nouveau revenu / Nouvelle dépense / Nouvelle épargne (Images 16, 17, 18)** — Les 3 tabs Revenu/Dépense/Épargne changent de couleur (bleu, orange, vert) ce qui est bien pour la sémantique, mais les quick amounts changent aussi de couleur et les placeholders changent aussi. Ça fait trop de choses qui bougent. Le champ montant "0.00" avec "Quel montant ?" en dessous est redondant — l'un ou l'autre suffit.

**Modifier le revenu (Image 9)** — Plus simple, donc plus réussi. Mais le gros bouton vert "Enregistrer" est stylistiquement différent du bouton "Ajouter" des écrans de création. Pas cohérent.

**Liste Budgets (Image 13)** — Bon écran. La hiérarchie 2025/2026 avec les mois est claire. La card "Ce mois-ci — Février" avec le point vert est un bon pattern. Mais les montants négatifs en orange et positifs en vert sur fond vert-gris créent une soupe de couleurs.

**Création de budget (Image 12)** — La bottom sheet avec le choix de modèle est propre. Les mini-résumés par modèle (revenus, dépenses, solde en couleurs) sont une bonne idée. Mais c'est dense pour une bottom sheet.

**Modèles (Images 3, 2, 1)** — L'écran liste (Image 3) est le plus "calme" de l'app, et paradoxalement le plus réussi visuellement. Le badge "Par défaut" vert est discret, les descriptions sont lisibles. Le détail d'un modèle (Image 2) est bien structuré avec Informations → Récapitulatif → Revenus → Dépenses. Le formulaire "Nouveau modèle" (Image 1) est minimal et clair.

**Compte (Image 14)** — Fonctionnel mais un peu brutal. La "ZONE DE DANGER" en rouge en bas est un pattern classique. Le bouton "Régénérer" pour la clé de secours en vert ne communique pas bien le risque associé — il devrait être orange ou rouge.

---

### Recommandations prioritaires

**1. Neutralise le fond.** Passe à un blanc pur ou un gris très léger (#F8F8F8) comme fond principal. Réserve le vert dégradé uniquement pour les écrans d'entrée (PIN, onboarding) et peut-être le header de l'accueil. Le "Calm Finance" ne vient pas d'un fond vert partout — il vient de l'espace blanc, de la typographie aérée, et du ton bienveillant que tu maîtrises déjà.

**2. Simplifie la hero card.** La carte "Ce qu'il te reste" est trop chargée. Le montant + le message + le cercle de pourcentage + les 3 pills en dessous, c'est 4 informations qui se battent. Essaie : montant principal très gros, message en dessous, et les pills Revenus/Dépenses/Épargne intégrées différemment (peut-être dans une section séparée plus bas).

**3. Unifie le système de couleurs.** Définis clairement : vert = marque / positif, orange = dépenses / attention, bleu = revenus / information. Et tiens-toi-y partout. Actuellement le vert sert à la fois de couleur de marque, de couleur positive, de couleur de fond, et de couleur d'action — c'est trop.

**4. Standardise les boutons.** Tu as au moins 4 styles de boutons différents : "Créer" texte (navigation bar), "Enregistrer" vert plein (modification), "Ajouter" gris (transaction), "Nouvelle transaction" vert plein (bottom sheet). Définis 2-3 variantes max et applique-les partout.

**5. Réduis la densité du budget mensuel.** C'est ton écran principal et il essaie d'en faire trop. Le filtre "À pointer / Toutes" + la hero card + le report + les sections par type, c'est 3 fonctions (dashboard, pointage, et vue détaillée) compressées dans un seul scroll. Envisage de séparer le "tableau de bord" (hero + résumé) de la "liste de pointage".

---

Tu as raison, et je comprends bien la tension. Le fond blanc pur c'est "safe" mais ça donne un résultat générique façon template Material Design. Les apps qui se démarquent sur Dribbble ont effectivement des fonds travaillés.

Le problème avec ton fond actuel n'est pas l'idée d'avoir un fond coloré — c'est l'exécution. Voici ce qui cloche spécifiquement :

Le dégradé vert est trop diffus et trop présent. Il couvre tout l'écran de manière uniforme, du haut en bas, sur chaque écran. Les apps que tu admires sur Dribbble utilisent la couleur de fond de manière **structurée** : un bloc de couleur en header qui s'arrête net, un fond teinté uniquement sur certaines zones, ou un dégradé qui ne vit que dans le premier tiers de l'écran. Chez toi, le vert est partout tout le temps, donc il ne crée plus de hiérarchie — il devient du bruit.

L'autre souci c'est que ton vert de fond entre en conflit avec tes couleurs sémantiques. Quand tes montants positifs sont verts, que ta marque est verte, que ton CTA est vert, ET que ton fond est vert... tout se fond ensemble. Les apps Dribbble qui utilisent des fonds colorés ont généralement une couleur de fond qui ne chevauche pas leurs couleurs fonctionnelles.

Quelques pistes qui garderaient du caractère sans le chaos actuel :

**Le fond teinté mais localisé.** Garde ton vert dégradé mais uniquement dans la zone hero/header (les 30-40% supérieurs de l'écran), avec une transition douce vers un fond neutre chaud (#FAFAF8 ou similaire) pour les listes en dessous. C'est ce que font beaucoup d'apps finance premium — Revolut, N26, Mono. La couleur forte en haut ancre la marque, le neutre en bas laisse respirer le contenu.

**Le fond warm neutral au lieu du blanc froid.** Entre le blanc pur et ton vert actuel, il y a un entre-deux que tu n'explores pas : un beige/crème très subtil (#FAF9F6, #F5F3EF) qui donne de la chaleur sans interférer avec tes couleurs financières. Ça colle bien avec l'esprit "Calm Finance" — pense à l'ambiance d'une app comme Bear ou Things, chaleureuse sans être colorée.

**Les surfaces plutôt que le fond.** Au lieu de colorer le fond de l'écran, tu pourrais travailler sur des cartes avec des fonds très légèrement teintés en vert pour les éléments positifs, en crème pour les éléments neutres. Le fond reste discret, mais chaque carte porte sa propre ambiance. Ça donne un résultat plus riche visuellement que le flat blanc, tout en gardant la lisibilité.

Le vrai problème à résoudre ce n'est pas "fond blanc vs fond coloré", c'est le fait que ta couleur de marque (vert) fait tout — fond, action, positif, marque — et du coup elle ne fait plus rien de distinctif. Si tu libères le vert du rôle de "fond partout", il redeviendra puissant là où il apparaît.

---

Le vrai problème dans ta DA : le vert fait tout.
Ta palette assigne au vert les rôles de : couleur primaire, fond principal (#F6FFF0), surfaces/cartes (#EBFFE6), accent positif (#48A353), ET actions principales. En pratique, ça veut dire que sur ton écran budget, le background, la hero card, les montants positifs, les boutons CTA et les badges "Par défaut" sont tous dans la même famille chromatique. Le résultat c'est exactement ce que tu ressens : pas harmonieux, tout se mélange.
Ce que je changerais dans ta DA :
Le fond devrait sortir de la famille verte. Ton fond actuel #F6FFF0 (blanc verdâtre) est si proche des surfaces #EBFFE6 et de ta couleur primaire qu'il n'y a plus de contraste entre les couches. C'est la source principale du manque d'harmonie. La stratégie A (header vert + corps neutre) ou C (fond neutre léger + cartes teintées par type) résoudrait ça tout en gardant l'identité Pulpe à travers la hero card, les actions et les accents.
La règle des couleurs financières est bonne mais incomplète dans la pratique. Ta DA dit ambre pour les dépenses et bleu pour l'épargne, mais sur les screenshots actuels, les icônes de revenus sont bleues, les montants de revenus sont verts, le badge "Récurrent" est gris, les chips de quick-amount changent de couleur selon le type... Il manque un tableau qui dit clairement "voici la couleur de chaque élément par contexte" plutôt que juste "dépense = ambre".
Le fond vert partout contredit directement ton pilier "Clarté". Ta DA dit "hiérarchie claire, information priorisée" mais ton background uniforme crée l'exact opposé — une surface homogène où rien ne ressort. Les apps "calm" que tu admires sur Dribbble obtiennent leur caractère par le contraste entre une zone de couleur forte et un espace de respiration, pas par une teinte appliquée partout.
Tu veux qu'on creuse une des trois stratégies en détail avec un mockup plus poussé sur un de tes écrans réels ?


<user-action-history> suite a cela j'ai maj la DA, qui est a jour d'ailleurs </user-action-history>

# Ajouts Dark Mode pour la DA Pulpe

> Modifications à intégrer dans la DA existante.

---

## 1. Ajout en section 3.1 — après "Surfaces et fonds"

Insérer une nouvelle sous-section :

---

### Dark Mode — Philosophie

Le dark mode Pulpe respecte les mêmes piliers émotionnels que le light mode. Le principe **"zone d'émotion / zone de contenu"** reste identique — seuls les tons changent.

#### Principes directeurs

| Principe | Application |
|----------|-------------|
| **Fonds système** | Utiliser les fonds natifs de chaque plateforme (pas de fond custom sombre). Le neutre chaud `#F7F6F3` n'a pas d'équivalent custom en dark — on délègue au système. |
| **Hero card préservé** | La hero card garde ses couleurs d'état mais en version désaturée/assombrie. L'émotion reste lisible. |
| **Couleurs financières adaptées** | Les tokens financiers passent à leurs variantes claires (higher-tone) pour rester lisibles sur fond sombre. Le bleu, l'ambre et le vert restent reconnaissables. |
| **Zones visuelles maintenues** | La zone d'émotion (header) utilise un dégradé sombre teinté selon l'état. La zone de contenu utilise le fond système sombre. La transition reste douce. |
| **Pas de vert dans les surfaces** | Même règle qu'en light : les surfaces sombres sont neutres, jamais teintées vert. |

#### Hero card en dark mode

| État | Fond hero (dark) | Texte hero |
|------|-----------------|------------|
| **Confortable** | Vert sombre désaturé | Blanc / vert clair |
| **Serré** | Ambre sombre désaturé | Blanc / ambre clair |
| **Déficit** | Rouge sombre désaturé | Blanc / rosé clair |

#### Zone d'émotion (header) en dark mode

| État | Teinte header (dark) | Transition vers |
|------|---------------------|-----------------|
| Confortable | Vert très sombre (`~#1A2E1D`) | Fond système sombre |
| Serré | Ambre très sombre (`~#2E2518`) | Fond système sombre |
| Déficit | Rouge très sombre (`~#2E1A1A`) | Fond système sombre |

Les hex sont indicatifs — les valeurs exactes sont ajustées par plateforme (§8).

#### Surfaces en dark mode

| Élément | Dark mode |
|---------|-----------|
| **Fond de contenu** | Fond système sombre natif (pas de custom) |
| **Cartes** | Surface système sombre élevée |
| **Séparateurs** | `outline-variant` du système |
| **Texte principal** | Blanc atténué (~87% opacité) |
| **Texte secondaire** | Blanc atténué (~60% opacité) |

---

## 2. Mise à jour section 3.7 — Couleurs financières

Ajouter un tableau après "Application par élément" :

---

#### Variantes dark mode des couleurs financières

Les tokens financiers ont une variante light et dark. La couleur reste la même famille, le ton change pour la lisibilité sur fond sombre.

| Token | Light | Dark | Principe |
|-------|-------|------|----------|
| `--pulpe-financial-income` | Bleu foncé (tertiary) | Bleu clair (tertiary-80+) | Plus lumineux sur fond sombre |
| `--pulpe-financial-expense` | Ambre foncé | Ambre clair | Plus lumineux sur fond sombre |
| `--pulpe-financial-savings` | Vert foncé (primary) | Vert clair (primary-80+) | Plus lumineux sur fond sombre |
| `--pulpe-financial-critical` | Rouge foncé (error) | Rouge clair (error-80+) | Plus lumineux sur fond sombre |

Les valeurs exactes sont dérivées des palettes Material (tonal palette, tone 80+ pour le dark). Elles vivent dans les DesignTokens du code.

---

## 3. Mise à jour section 8.1 — iOS

Ajouter après "Surfaces" :

---

#### Dark mode iOS

| Élément | Implémentation |
|---------|---------------|
| **Fond de contenu** | `Color(.systemGroupedBackground)` — fond système, pas de custom |
| **Cartes** | `Color(.secondarySystemGroupedBackground)` |
| **Hero card** | Couleur d'état en `.opacity(0.85)` ou variante `-dark` de l'Asset Catalog |
| **Header dégradé** | Teinte sombre de la couleur d'état → fond système. Utiliser `LinearGradient` avec les couleurs d'état dark. |
| **Couleurs financières** | Variantes dark définies dans l'Asset Catalog (déjà en place : `FinancialIncome`, `FinancialExpense`, `FinancialSavings` ont des variantes dark) |
| **Texte sur hero** | `.white` ou variante claire de la couleur d'état |
| **Liquid Glass** | Fonctionne nativement en dark — pas d'ajustement nécessaire |

**Couleurs d'état header (dark indicatif) :**

| État | Teinte header | Hex indicatif |
|------|--------------|---------------|
| Confortable | Vert très sombre | `#1A2E1D` → `systemGroupedBackground` |
| Serré | Ambre très sombre | `#2E2518` → `systemGroupedBackground` |
| Déficit | Rouge très sombre | `#2E1A1A` → `systemGroupedBackground` |

---

## 4. Mise à jour section 8.2 — Web

Remplacer la sous-section "Dark mode" existante par :

---

#### Dark mode Web

**Activation :**
- Classe `.dark-theme` sur `<html>` (toggle utilisateur)
- Variante Tailwind `dark:` scopée via `@custom-variant dark (&:where(.dark-theme, .dark-theme *))`
- Fallback `@media (prefers-color-scheme: dark)` pour les utilisateurs sans préférence explicite

**Fond de contenu :**
- Le body utilise `--mat-sys-surface` qui bascule automatiquement via Material `color-scheme: dark`
- Le token `--pulpe-neutral-warm` n'a PAS de variante dark custom — en dark, le fond est `--mat-sys-surface` (le système gère)
- Les cartes utilisent `--mat-sys-surface-container` ou `-container-high`

**Zone d'émotion (hero) :**
- Les CSS variables hero changent selon le thème :

```css
.dark-theme {
  --pulpe-hero-bg-comfortable: #1A2E1D;
  --pulpe-hero-bg-tight: #2E2518;
  --pulpe-hero-bg-deficit: #2E1A1A;
}
```

**Couleurs financières :**
- Les tokens `--pulpe-financial-*` sont redéfinis dans `.dark-theme` avec les variantes claires
- Ils mappent vers les tons 80+ de chaque palette tonale Material

```css
.dark-theme {
  --pulpe-financial-income: var(--mat-sys-tertiary);    /* bascule auto light/dark */
  --pulpe-financial-expense: /* ambre tone 80 */;
  --pulpe-financial-savings: var(--mat-sys-primary);    /* bascule auto light/dark */
  --pulpe-financial-critical: var(--mat-sys-error);     /* bascule auto light/dark */
}
```

**Gradient de marque :**
- Le `.pulpe-gradient` a déjà des variantes dark (cf. `styles.scss`)
- En dark : tons sombres avec accents verts subtils au lieu du gradient néon

**Points d'attention :**
- Ne jamais utiliser de couleur hardcodée qui ne bascule pas — toujours passer par les tokens
- Tester les contrastes WCAG AA sur fond sombre (minimum 4.5:1 pour le texte, 3:1 pour les éléments graphiques)
- Les ombres (`shadow-*`) sont invisibles sur fond sombre — utiliser des bordures subtiles ou des élévations de surface à la place

---

## 5. Mise à jour section 7 — Checklist

Ajouter un item :

```
- [ ] **Dark mode** : Les tokens basculent-ils correctement ? Les contrastes sont-ils suffisants ?
```





C'est une excellente initiative de prendre du recul sur votre travail. Tout d'abord, rassurez-vous : **la base fonctionnelle de votre application est très solide**. On comprend que c'est une application de gestion de budget complète. 

Cependant, vous avez raison, l'interface souffre de problèmes de consistance, de choix de couleurs et de surcharge cognitive.

Voici une review UX/UI détaillée, divisée par catégories, avec des pistes d'amélioration concrètes.

---

### 🎨 1. Couleurs et Harmonie (UI)
*Le problème principal vient du fond vert pâle omniprésent combiné à des couleurs sémantiques qui manquent de peps ou de contraste.*

*   **Le fond d'application :** Le vert pâle (`#E8F5E9` ou similaire) en arrière-plan de toutes les vues "salit" les autres couleurs. 
    *   *Solution :* Passez à un fond **blanc pur** ou un gris ultra-clair (ex: `#F8F9FA`). Réservez le vert pour votre couleur de marque (boutons principaux, icônes) et pour indiquer un solde positif.
*   **Les couleurs sémantiques (Les alertes) :** Sur les images 2 et 10, le bloc "Déficit ce mois" utilise un jaune moutarde/marron. Psychologiquement, un déficit doit alerter l'utilisateur, mais cette couleur fait "sale" et manque de contraste avec le texte blanc.
    *   *Solution :* Pour les déficits/dépenses, utilisez un rouge doux, un corail ou un orange vif (ex: `#FF6B6B` ou `#FF9F43`). Pour les revenus/positif, gardez un beau vert ou un bleu franc.
*   **Contraste des textes :** Les textes gris sur les fonds colorés (ou sur le fond vert) manquent parfois de lisibilité (ex: "Ce mois sera serré - mais tu le sais" sur l'image 10).
*   **Les ombres (Drop shadows) :** Elles sont inconsistantes. Parfois très diffuses, parfois absentes. La barre de navigation du bas "flotte" avec une ombre très prononcée qui alourdit l'écran.
    *   *Solution :* Harmonisez vos ombres. Utilisez des ombres très douces (opacité 5% à 10%) dirigées vers le bas. Ancrez la barre de navigation tout en bas de l'écran sans la faire flotter.

### 🧠 2. Intuitivité et Navigation (UX)
*Le problème ici est la "surcharge d'informations" et l'inconstance des boutons d'action.*

*   **Le bouton "Ajouter" (+)** : Sur l'image 2 (Accueil), le bouton `+` est un gros bouton flottant (FAB) en bas à droite. Sur l'image 8 ou 11 (Budgets), c'est un petit bouton en haut à droite. 
    *   *Solution :* Soyez constant. Le mieux pour une app de budget est un gros bouton central dans la barre de navigation du bas, ou un FAB toujours en bas à droite, qui ouvre un menu : "Ajouter un revenu / Ajouter une dépense".
*   **Le vocabulaire comptable :** Sur l'image 11, le sélecteur "À pointer / Toutes". "Pointer" est un terme de comptable. Un utilisateur lambda ne saura pas ce que cela veut dire (est-ce que ça veut dire "à payer" ? "à vérifier" ?).
    *   *Solution :* Utilisez des termes plus simples : "En attente" / "Validées", ou "À vérifier".
*   **L'inception des Modales (Les pop-ups qui s'empilent) :**
    *   Image 14 : On clique sur "Loyer".
    *   Image 15 : Ça ouvre un tiroir (bottom sheet) pour les détails du loyer.
    *   Image 18 : On clique sur "Nouvelle transaction", ça ouvre un *autre* tiroir par-dessus.
    *   *Solution :* Évitez d'empiler les modales. Si je clique sur "Loyer", amenez-moi sur une **nouvelle page entière** dédiée au Loyer. Réservez les "bottom sheets" uniquement pour les actions rapides (Ajouter une transaction).
*   **La barre de navigation (Bottom Tab Bar) :** Elle est sous forme de "pilule" flottante (Accueil - Budgets - Modèles). Elle est visuellement trop grosse et empiète sur le contenu scrollable (comme les dernières dépenses). 
    *   *Solution :* Faites une barre de navigation classique qui prend toute la largeur en bas de l'écran (avec un effet de flou/blur en arrière-plan).

### 🔍 3. Retours spécifiques par écrans

*   **Images 4, 5, 6 (Ajout de transaction) :**
    *   Les "pilules" pour choisir le type (Revenu, Dépense, Épargne) ne ressemblent pas à des onglets. On a l'impression que "Revenu" est un bouton validé. 
    *   Les raccourcis de montants (10 CHF, 15 CHF, etc.) ont des couleurs de fond différentes sans raison apparente. Mettez-les tous d'une couleur neutre (gris clair).
    *   Le champ de saisie du montant (0.00) avec la ligne verte en dessous fait très "Android 2014" (Material Design V1). Optez pour une typographie très grande et audacieuse, sans forcément de ligne en dessous.
*   **Image 11 (Vue du mois positif) :**
    *   La hiérarchie visuelle est bonne, mais le gros bloc vert foncé "Ce qu'il te reste" écrase le reste. 
    *   Les trois petits blocs en dessous (Revenus, Dépenses, Épargne) ont des flèches et des couleurs différentes. Harmonisez l'iconographie.
*   **Image 12 (Vue avec actions "Comptabiliser / Supprimer") :**
    *   La façon dont les boutons d'action apparaissent sous "CHF 3'444.00" (le fond gris bizarre) donne l'impression d'un bug d'affichage. 
    *   *Solution :* Si c'est un "swipe" (glisser vers la gauche), le bouton doit apparaître dans le prolongement de la carte, pas en dessous en cassant la hauteur de la carte.
*   **Image 13 (Menu déroulant des mois) :**
    *   La liste est beaucoup trop longue et cache tout l'écran. 
    *   *Solution :* Une navigation horizontale par flèches (`< Février >`) est souvent plus pratique pour passer d'un mois à l'autre.
*   **Image 19 & 20 (Modèles) :**
    *   L'interface est ici beaucoup plus aérée et propre ! C'est dans cette direction "Clean" qu'il faut emmener le reste de l'application.

### 📋 Plan d'action recommandé (Par quoi commencer)

1.  **Changer le fond :** Passez le fond de tous les écrans en blanc (`#FFFFFF`) ou gris très clair (`#F8F9FA`). Vous verrez instantanément l'application s'éclaircir.
2.  **Fixer la navigation :** Remplacez la pilule flottante du bas par une barre de navigation fixe classique prenant toute la largeur. Définissez un seul endroit pour le bouton `+` principal.
3.  **Ajuster les couleurs d'état :** Choisissez un rouge/orange propre pour les dépenses/déficits, et un vert propre pour les revenus/positifs. Appliquez ces couleurs avec parcimonie (sur les textes des montants ou les icônes, pas sur des gros blocs de fond).
4.  **Uniformiser les cartes (Cards) :** Assurez-vous que toutes vos cartes blanches ont le même arrondi (border-radius) et la même ombre subtile. Actuellement, certaines sont très rondes, d'autres moins.

Vous avez déjà fait le plus dur : la logique et l'architecture de l'information sont là. Avec un nettoyage visuel (plus de blanc, moins de couleurs mélangées, des alignements plus stricts), votre application aura un aspect très professionnel.
