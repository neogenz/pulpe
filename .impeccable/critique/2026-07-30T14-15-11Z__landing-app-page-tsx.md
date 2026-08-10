---
target: landing/app/page.tsx
total_score: 32
p0_count: 0
p1_count: 1
timestamp: 2026-07-30T14-15-11Z
slug: landing-app-page-tsx
---
Method: dual-agent (A: revue design, Opus, captures Playwright 390/768/1440 · B: détecteur `detect.mjs` + overlay in-page + axe-core). Cible : `landing/app/page.tsx` sur la branche `fix/landing-prod-defects` (worktree), servie en dev sur `http://localhost:3105`. Baseline de comparaison : le snapshot `2026-07-30T08-00-02Z` (prod `preview`, 28/40).

## Design Health Score

| # | Heuristique | prod (30/07) | maintenant | Écart dû à | Problème clé |
|---|---|---|---|---|---|
| 1 | Visibilité de l'état | 2 | 3 | **re-notation** | Toujours aucun indicateur de section active sur 7176px et 4 ancres |
| 2 | Correspondance monde réel | 4 | 4 | — | n/a — « Les impôts tombent en juillet », tutoiement, zéro jargon |
| 3 | Contrôle et liberté | 3 | 3 | — | Le sticky CTA mobile (60px sur 854) reste permanent et non masquable |
| 4 | Cohérence et standards | 3 | **2** | **régression réelle** | Deux séparateurs CHF sur la même page ; h2 à 3 tailles, h3 à 5 |
| 5 | Prévention des erreurs | 3 | 3 | — | `1 200 CHF` en espace ASCII : le nombre peut casser en fin de ligne |
| 6 | Reconnaître plutôt que rappeler | 3 | 3 | — | Aucun libellé de nav ne reprend un titre de section |
| 7 | Flexibilité et efficacité | 3 | 3 | — | Ordre clavier propre (14 arrêts), skip link fonctionnel, 4 ancres OK |
| 8 | Esthétique et minimalisme | 2 | **3** | **correctif livré** | Le hero porte enfin la preuve produit ; reste 255px morts dans WhyFree |
| 9 | Récupération d'erreur | 2 | 4 | **re-notation** | n/a — aucun formulaire, ni avant ni maintenant |
| 10 | Aide et documentation | 3 | 4 | **re-notation** | n/a — la FAQ est le meilleur actif de la page |
| **Total** | | **28/40** | **32/40** | | Bon (bas de fourchette) → Bon (milieu) |

**Lecture honnête du +4.** Un seul point est gagné par un correctif livré (#8, la preuve produit au-dessus du pli). Un point est **perdu** pour de vraies raisons (#4). Les trois autres (+4 brut sur #1, #9, #10) sont la même réalité notée autrement par un autre relecteur : rien n'a changé sur l'indicateur de section, les formulaires ou la FAQ. Le score réel du travail livré, c'est **+1 −1 sur les deux heuristiques que les phases touchaient**, pas +4.

## Anti-Patterns Verdict

**Évaluation LLM : ce n'est pas du slop.** Le réflexe de catégorie « app de budget suisse » prédirait navy froid ou vert menthe, Inter, `#FFFFFF` pur, cartes en verre, ombres noires génériques. La page en refuse quatre sur six : canvas chaud `#F7F6F3`, Poppins en famille unique, forêt `#006E25`, ombres teintées `rgba(0,60,20,.06)`. La couche artisanale n'est pas imitable par défaut : un stroke feutre à 176,5° qui se dessine au scroll, une flèche manuscrite « Prêt à respirer ? », et une FAQ qui répond à « pourquoi pas de synchro bancaire » par « le soir après le boulot ».

Ce qui reste template, en revanche : **9 icônes `lucide-react` de contenu au stroke par défaut** (PainPoints 2, Features 2, Platforms 2, WhyFree 3), plus 3 dans Roadmap, alors que PRODUCT.md demande Phosphor ou Heroicons outline. Et **quatre grilles 3-up** (`md:grid-cols-3` dans HowItWorks, Roadmap, Testimonials, WhyFree) là où `landing/DESIGN.md` §6 liste « equal card grids » sous **Don't**. Nuance sur laquelle je corrige l'agent A : HowItWorks est un `<ol>` numéroté dont l'ordre porte l'information — une séquence assumée, pas une grille de cartes. Testimonials, WhyFree et Roadmap sont les trois qui lisent template.

**Scan déterministe : `detect.mjs` sort en 0, 0 finding** sur 33 fichiers de `landing/app` + `landing/components`. Identique à la baseline prod.

Le détecteur **in-page** (overlay) remonte 10 items ; j'en ai vérifié 7 comme non-défauts :

| Finding | Verdict |
|---|---|
| `low-contrast` ×6 sur `mark.marker-highlight` et `strong` (1,2:1) | **faux positif** — le stroke peint un `linear-gradient` sur `background-color: transparent`, l'outil lit donc `#000000`. Rapport réel mesuré : **12,4:1** |
| `single-font` sur `body` | **par conception** — The Single Family Rule, `landing/DESIGN.md` §3 |
| `line-length` ×2 (~85ch annoncés) | **surévalué** — capacité mesurée max 68ch à 1440. Le vrai écart est inverse, voir Observations |
| `layout-transition` sur la barre de progression | **réel** — `transition-[width]` (`HeroDashboard.tsx:114`), animation d'une propriété de layout ; `motion-reduce:transition-none` est bien là |

**Overlay visuel :** il a bien existé — 19 nœuds DOM d'overlay, encadré jaune « low contrast text » autour de la phrase surlignée du hero, capture à l'appui. Mais l'agent B a arrêté le live-server et fermé son onglet en fin de passe : **aucun overlay n'est visible chez toi en ce moment**. La page sur le port 3105 est propre.

## Overall Impression

La page fait ce qu'on lui a demandé de faire. Les deux P1 prod de la baseline sont fermés et mesurés : la preuve produit est passée d'un liseré de 40px à 284px au-dessus du pli, et le sticky CTA a retrouvé sa propre surface. Ce qui reste n'est plus du même ordre : ce ne sont plus des défauts de conception, ce sont des défauts de **finition et de cohérence**. La page sait ce qu'elle raconte ; elle ne s'est pas encore accordée sur la façon de l'écrire — deux orthographes du franc, huit tailles de titre pour deux rôles, une couleur pour deux sens. Sur une surface de marque où le design *est* l'argument, c'est ça qui plafonne le résultat, pas la composition.

Et le plus gros gisement n'est pas un défaut : c'est que le meilleur texte du site est replié derrière un clic, une section avant le CTA final.

## What's Working

**La copie de la FAQ est le meilleur actif de la page.** « J'aurais aimé proposer une synchronisation bancaire… pour un projet que je développe seul, le soir après le boulot, le coût est trop élevé. » Elle transforme la plus grosse faiblesse du produit en preuve d'honnêteté, parce qu'elle nomme une contrainte réelle au lieu de la tourner. Aucun registre marketing ne survit à cette phrase — c'est exactement ce qui désarme.

**L'accessibilité est mesurée, pas affirmée, et elle tient.** 0 nœud texte sous AA sur 173 (390px et 1440px), le plus serré à 4,72:1 avec +0,22 de marge, 0 violation axe, focus visible sur les 15 premiers tabs, reduced-motion qui pose bien chaque reveal, nav mobile en `<details>` + `inert` + `aria-hidden` qui fonctionne sans JS, courbe du hero en `role="img"` avec label français.

**Le contrat de rythme est réellement respecté.** Les sept sections centrales sont à `padding: 60px 0`, ce qui produit exactement la frontière de 120px que `landing/DESIGN.md` §5 spécifie, la primitive contribuant la moitié de chaque côté. Le bug de double application documenté est absent. Le tracking display reste dans les clous à toutes les tailles (−0,04em, jamais plus serré).

## Priority Issues

**[P1] Deux séparateurs de milliers pour le franc sur la même page, dont un qui peut casser en fin de ligne.** `Features.tsx:47,92` écrit `1&apos;200 CHF` et `1&apos;560 / 2&apos;400 CHF` — apostrophe ASCII. `HeroDashboard.tsx:13,109,110` écrit `1 200 CHF`, `3 374 CHF` et `HowItWorks.tsx:21,32,43` écrit `3 500 CHF`, `1 400 CHF` — espace ASCII simple. Aucun des deux n'est le séparateur de-CH, qui est `’` (U+2019). *Pourquoi ça compte :* une page qui vend « je vois clair sur mon argent » orthographie l'argent de deux façons à 1400px d'écart, et l'espace ASCII autorise `1 200 CHF` à se couper de sorte que « 1 » finisse une ligne et « 200 CHF » commence la suivante. Le formatage monétaire est le seul endroit où un produit de budget ne peut pas avoir l'air hésitant. *À noter :* deux des instances en espace simple ont été **ajoutées par la phase 4** — avant, HowItWorks affichait des captures, pas des montants vivants. *Correctif :* un formateur unique émettant `’` pour CHF ; le dépôt impose déjà la règle (`getCurrencyFormatter` dans `shared/src/currency-format.ts`, `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md`). → `/impeccable harden`

**[P2] Des éléments pairs à la même échelle sont désalignés dans trois sections consécutives.** Mesuré à 1440 : **Platforms** — titres de cartes paires à **36px et 30px** (« Pulpe pour iPhone » / « Dans ton navigateur »), confirmé. **Features** — les deux cartes sont égalisées (`top=3263, height=491`) mais leurs éléments internes démarrent à 3676 et 3648, **28px d'écart** sur une paire côte à côte. **Testimonials** — les trois figures sont égales (`top=2755, height=203`) mais `Sylvie G.` n'a **pas de champ `role`** là où ses deux voisines en ont un, et l'attribution n'est pas ancrée en bas : elle retombe 21px plus haut. *Pourquoi ça compte :* sur une surface de marque, trois ratés d'alignement d'affilée lisent « assemblé », ce qui contredit « Pulpe recalcule pour toi ». *Correctif :* `mt-auto` sur l'attribution et sur le panneau interne de Features, une seule taille h3 pour des cartes paires, remplir ou retirer le rôle de Sylvie. *Divergence assumée :* l'agent A classait ça P1 ; aucun visiteur n'est bloqué ni égaré, donc P2. → `/impeccable polish`

**[P2] Huit tailles de titre pour deux rôles.** h2 à **48 / 60 / 96px**, h3 à **16 / 20 / 24 / 30 / 36px**, mesuré sur la page rendue. La paire 48↔60 est un pas de 1,25 dans le *même* rôle sans distinction sémantique. Le dépôt argumente déjà contre exactement ça, dans `globals.css:210` : « 14px, not 15px: this was the page's only 0.9375rem, a step 1.07 away from the 14px it sat next to. » Le même standard appliqué à l'échelle display condamne 48/60. *Pourquoi ça compte :* c'est le mécanisme derrière l'impression que chaque section se ressemble — sept frontières identiques de 120px plus des h2 quasi identiques, aucune section ne prend le dessus. *Correctif :* deux tailles h2 (section = 48, clôture = 96), deux tailles h3 (carte = 30, sous-titre = 20). → `/impeccable distill`

**[P2] Une couleur porte deux sens contradictoires.** `--color-marker-highlight-proof: #F4DF8A` est à la fois le **segment de données « Impôts »** de la carte 3 de HowItWorks et le **surligneur de preuve sociale** des témoignages. PRODUCT.md principe 3 est explicite : « Every hue maps to a financial concept (income=blue, expense=amber, savings=green)… Misusing color is lying. » L'ambre veut déjà dire *dépense* dans le produit. Le visiteur qui ouvre l'app ensuite y trouve ambre = dépense ; sur la landing, ambre = « citation à lire ». *Second point, plus léger :* la pastille de légende de 6px mesure **1,32:1** contre `#FFFEFA`, sous les 3:1 que WCAG 1.4.11 demande pour un graphique nécessaire à la compréhension. La compréhension est sauvée par le libellé « Impôts » posé juste à côté, mais l'association pastille → segment ne l'est pas. *Correctif :* déplacer le surligneur de preuve vers un neutre ou un ton feuille, et prendre `#B35800` de PRODUCT.md pour la dépense dans le graphe. → `/impeccable colorize`

**[P2] La meilleure réassurance de la page est cachée au point exact d'hésitation maximale.** Six lignes repliées identiquement stylées entre la note du créateur et le CTA final. « C'est vraiment gratuit ? » et « Mes montants sont-ils protégés ? » — les deux objections qui décident de la conversion — sont fermées et indiscernables de « Combien de temps faut-il pour commencer ? ». La réponse AES-256-GCM / deux clés séparées / « ni transmis ni revendus » est le texte le plus persuasif du site et demande un clic pour exister. Six pastilles fermées juste avant le CTA final, c'est un mur, pas une réassurance. *Correctif :* ouvrir par défaut les réponses prix et sécurité (ou promouvoir la sécurité en bloc visible à côté du CTA) et redescendre l'accordéon à quatre items. → `/impeccable clarify`

**[P3] La courbe de projection du hero est tronquée à ras des deux bords.** `viewBox="0 0 100 36"` avec `preserveAspectRatio="none"` : le tracé finit à x=100, donc la ligne s'arrête net contre le bord et le remplissage se termine par des arêtes verticales dures des deux côtés. Les caps arrondis de la ligne ne correspondent pas aux angles droits du fill. Vérifié comme rendu à ras, pas comme débordement. *Pourquoi ça compte :* le moment signature du produit ressemble à une capture recadrée plutôt qu'à un graphique. *Correctif :* rentrer la série de ~4 unités, terminer le fill sur une ligne de base, ajouter un point d'extrémité. → `/impeccable polish`

## Comparaison mesurée, baseline prod → maintenant

| Contrôle | prod (30/07) | maintenant | |
|---|---|---|---|
| Détecteur CLI | exit 0, 0 finding | exit 0, 0 finding | = |
| Violations axe (1440 + 390) | 0 | 0 | = |
| Nœuds texte sous AA | 0 | 0 (sur 173) | = |
| Contraste le plus serré | 4,70:1 (+0,20) | 4,72:1 (+0,22) | = |
| h1 / niveaux sautés | 1 / 0 | 1 / 0 (19 titres) | = |
| Images sans alt | 0 | 0 | = |
| Cibles tactiles < 44px | 0 | 0 | = |
| Focus visible, 15 premiers tabs | 15/15 | 15/15 | = |
| Débordement horizontal 320px | non | non | = |
| Affordance nav mobile | menu `<details>` | menu `<details>` | = |
| Contenu masqué par le mouvement | 0 | 0 | = |
| **Dashboard visible au-dessus du pli (1440×900)** | **40px** | **284px** | **+244px** |
| Dashboard à 1280×720 / 390×854 | non mesuré | 198px / 226px | |
| Sticky CTA sur la carte Platforms | `bg-primary` sur `bg-primary` | surface propre `#FFFEFA` + ombre | corrigé |
| `<main>` padding-bottom | absent (occlusion permanente) | 72px | corrigé |
| Classe morte `bg-lime/15` | présente, 0 règle compilée | supprimée (0 dans le CSS compilé) | corrigé |
| `aria-label` sur `div` sans rôle | oui (axe : serious) | sur `<svg role="img">` | corrigé |
| Palier 15px de l'échelle | ouvert | fermé (les 2 restants sont des commentaires) | corrigé |
| Mesure des réponses FAQ | ~91ch | 68ch max sur la page | corrigé |
| Assets déployés | — | −723 Ko, −20 fichiers | |
| Hauteur de page (1440) | 7215px | 7176px | −39px |
| Erreurs console / requêtes échouées | — | 0 / 0 | |

Les onze premières lignes sont les invariants que le plan s'engageait à préserver. Ils tiennent tous.

## Persona Red Flags

**Jordan (première visite, 20 s pour décider).** Le hero fonctionne : promesse, preuve, un CTA, trois puces de confiance. HowItWorks le freine : le numéro d'étape est placé **sous** le visuel en desktop, donc il scanne trois cartes de données avant d'apprendre qu'il s'agissait des étapes 1-2-3. La carte 3 lui tend ensuite six montants et une légende de quatre entrées. Aucun libellé de nav ne reprend un titre de section : s'il dépasse quelque chose, il ne peut pas y revenir par son nom.

**Riley (testeur).** Trouve le bug d'argent tout de suite : `1 200 CHF` dans le hero, `1'200 CHF` dans Features, aucun des deux conforme à l'usage suisse. Puis la série de désalignements : 28px dans Features, 21px dans Testimonials, 36 contre 30px dans Platforms. Puis Sylvie G. sans intitulé de poste quand ses deux voisines en ont. Là où il ne trouve rien : contraste (0/173), cibles tactiles, ordre clavier, nav `inert`, reduced-motion, les quatre ancres. Une fragilité étroite : `.arrow-note-ready` clippe « Prêt à respirer ? » à `inset(0 100% 0 0)` — si le JS tourne mais que l'IntersectionObserver ne se déclenche jamais, le texte reste invisible. Reproduit seulement en cassant le timing du scroll, jamais en navigation normale, et le rendu sans JS est correct.

**Casey (mobile, une main, 390px).** La persona la mieux servie : sticky CTA toujours atteignable, toutes les cibles au-dessus de 44px, burger natif. Deux ratés : **le flou de la navbar flottante est trop faible** — à 3200px de scroll on lit le corps de texte à travers le verre, à côté du logo, seul endroit où la Navigation Glass Rule entre en conflit avec la lisibilité. Et le menu mobile est une **prise de plein écran opaque** avec quatre liens flottant dans le tiers inférieur, ~300px de vide au-dessus et ~200px en dessous.

**Sofia, 29 ans, Genève — la réfugiée d'Excel.** La page parle sa langue (« les formules deviennent vite fragiles dès que tu bouges une ligne »). Deux choses cassent pour elle précisément. D'abord **elle lit les chiffres, c'est ce qu'elle faisait toute la journée dans Excel** — et la page n'arrive pas à se mettre d'accord entre `1 200` et `1'200`. C'est exactement la classe d'incohérence qui lui a fait perdre confiance en son propre tableur. Ensuite **elle décide si elle confie son salaire au projet du soir d'un inconnu**, et la réponse à cette question est repliée dans la ligne 4 de la FAQ, pendant que trois témoignages sans visage ni nom complet tiennent lieu de preuve.

## Minor Observations

- `Vue annuelle` (12px/500, en haut à droite du dashboard) et `Tu vois venir` (14px/600, `#006E25`) occupent la place d'un sélecteur de période et d'un lien « voir plus », mais sont un `<span>` et un `<p>` statiques. Dans une UI produit simulée, `Vue annuelle` lit comme un contrôle cassé.
- **La mesure du corps de texte manque son propre contrat, mais par le bas.** `landing/DESIGN.md` §3 vise 65–75ch ; une seule ligne y arrive (la note du créateur, ~68ch). Tout le reste tourne entre 33 et 61ch, sous-titre du hero compris. Le correctif de la phase 6 a bien fermé le dépassement à 91ch — il l'a fermé un peu trop loin.
- À **768px**, deux paragraphes des cartes Platforms atteignent 76–77ch réalisés dans une colonne de 648px. C'est le seul endroit où la mesure dépasse encore, de 1 à 2ch.
- **WhyFree laisse 255px morts** dans sa colonne gauche à 1440. Et le portrait du fondateur est éclairé en **orange saturé et cyan électrique** — le seul évènement chromatique non vert de la page, contre une palette documentée neutre-chaud plus forêt.
- **PainPoints termine sur un filet orphelin** : `border-y` sur le conteneur plus `border-t` entre items, sur une liste de deux, laisse une règle de clôture loin sous le dernier texte. Lit comme un tableau auquel il manque sa troisième ligne.
- Le portrait du fondateur est en `loading="lazy"` (défaut de `next/image`, pas de `priority`). Le visage qui porte l'argument de confiance apparaît en retard sur connexion lente.
- Le CTA du header disparaît sous `lg`, correctement compensé par le StickyCTA. À 768px cette barre fait toutefois 736px de large en permanence, pour un viewport qui a la place d'un bouton en ligne.
- `transition-[width]` sur la barre de progression du dashboard (`HeroDashboard.tsx:114`) animera une propriété de layout ; `transform: scaleX()` ferait le même effet sans recalcul. `motion-reduce:transition-none` est déjà là.
- Le serveur de dev affiche l'indicateur Next.js en bas à gauche — artefact de `next dev`, absent en production.

## Questions to Consider

1. **La page dit « je code seul, le soir après le boulot », puis affiche trois témoignages anonymes sans visage et avec un nom de famille initialisé.** L'un des deux est ton différenciateur ; l'autre est ce que livre n'importe quel template SaaS. Si tu supprimais Testimonials et donnais cet espace vertical à la réponse sécurité et à la note du créateur, la page devient-elle *plus* crédible — et si la réponse honnête est oui, que fait encore cette section ?

2. **Ton propre `DESIGN.md` interdit les grilles de cartes égales, et trois sections en livrent une.** Soit la règle est juste et Testimonials / WhyFree / Roadmap sont à restructurer, soit c'est une fiction d'intention qui continuera d'être violée et de générer du bruit d'audit. Laquelle des deux — et si un document seed peut être ignoré trois fois sur la seule page qu'il gouverne, à quoi sert-il ?

3. **Sept sections, sept frontières identiques de 120px, h2 à 48 et 60 sans différence sémantique.** La page est parfaitement régulière, et c'est pour ça que rien n'y semble *important* après le hero. Si tu devais rendre exactement une section parmi PainPoints / HowItWorks / Features / Platforms / WhyFree deux fois plus forte que les autres, laquelle le mérite — et que dit la réponse sur le poids actuel des quatre autres ?
