---
objective: "Le retour arrière rend une page à l'endroit exact où l'utilisateur l'a quittée, au desktop comme au mobile, sans déplacer un seul en-tête ni une seule barre collante."
status: reviewed
---

# Plan: Restaurer la position de défilement au retour arrière

## Overview

| Field      | Value                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| **Goal**   | Rendre la restauration de défilement indépendante du conteneur qui défile, qui change avec la largeur. |
| **Source** | Mesure navigateur du 2026-08-06 sur `/savings-goals/{id}` → `/budget/{id}` → retour arrière.            |

## Le défaut, mesuré

| Largeur | Conteneur qui défile           | Avant → après retour |
| ------- | ------------------------------ | -------------------- |
| 1280 px | `<main>` (`MAIN.scrollTop`)    | 1528 → **0** ✗       |
| 375 px  | le document (`window.scrollY`) | 1703 → **1703** ✓    |

`core.ts:117-119` pose `withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })`.
Le `RouterScroller` d'Angular lit et écrit la position via `ViewportScroller`, dont
l'implémentation par défaut vise **la fenêtre**. Au mobile le document défile, donc la
restauration atterrit. Au desktop `main-layout.ts:457` pose
`[class.overflow-y-auto]="!isHandset()"` : c'est `<main>` qui défile, la fenêtre n'a jamais
bougé, il n'y a rien à restaurer.

Ce n'est pas un défaut de la page objectif d'épargne où il a été rapporté. Il touche toute
page assez longue pour défiler, au desktop uniquement.

## Deux routes, une seule sans casse

**Route écartée — faire défiler le document au desktop aussi.** Retirer l'`overflow-y-auto`
de `<main>` ferait de la fenêtre le conteneur partout, et la restauration native marcherait
sans une ligne de TypeScript. Mais un élément `sticky` se colle à **son** conteneur de
défilement : changer le conteneur déplace le bloc conteneur des cinq surfaces collantes de
l'app d'un coup.

| Surface collante                                             | Où                                    | Portée         |
| ------------------------------------------------------------ | ------------------------------------- | -------------- |
| Barre d'action de page                                        | `main-layout.ts:479`, `:575-586`      | hors `<main>`  |
| `mat-toolbar` + fil d'Ariane                                  | `main-layout.ts:539-554`              | hors `<main>`  |
| Aperçu live en colonne droite (`lg:sticky lg:top-8`)          | `complete-profile-page.ts:332`, `:757` | dans `<main>`  |
| Barre de soumission (`sticky bottom-0 lg:bottom-[-2rem]`)     | `complete-profile-page.ts:720`         | dans `<main>`  |
| Barre du simulateur de plan                                   | `savings-goal-detail-page.ts:696`      | dans `<main>`  |

Le commentaire de `main-layout.ts:577-580` dit déjà pourquoi la barre d'action n'est pas
`sticky` au desktop : elle y laisserait un trou de 8 px sous elle. Cette disposition est un
choix écrit, pas un accident.

**Route retenue — un `ViewportScroller` qui vise le conteneur réel.** Le service ne touche
à aucune disposition : il lit et écrit un `scrollTop`. Les cinq surfaces ci-dessus gardent
leur conteneur, leur position et leurs marges négatives. La seule chose qui change est
**à qui** Angular demande la position et à qui il la repose.

## Phases

| #   | Phase                                                              | File                         |
| --- | ------------------------------------------------------------------ | ---------------------------- |
| 1   | La position se lit et se repose sur le conteneur qui défile vraiment | [`phase-1.md`](./phase-1.md) |
| 2   | La restauration attend que la page ait retrouvé sa hauteur           | [`phase-2.md`](./phase-2.md) |

## Decisions

| Decision                                                                                                     | Why                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remplacer l'implémentation de `ViewportScroller` par injection, plutôt que déplacer le défilement au desktop.  | `ViewportScroller` est une classe abstraite `@publicApi` avec un `ɵprov` : la remplacer est le point d'extension prévu. Elle ne décide d'aucune disposition, donc aucune surface collante ne bouge. L'autre route touche le bloc conteneur de cinq surfaces pour corriger une restauration.                 |
| Détecter le conteneur par son `overflow-y` calculé, jamais par un point de rupture.                            | Le point de rupture du shell s'exprime déjà à trois endroits et un `600px` codé en dur casse le paysage. Lire `getComputedStyle(main).overflowY` observe le résultat de `[class.overflow-y-auto]="!isHandset()"` sans jamais redire la condition — le service reste juste si le point de rupture change.     |
| Une restauration bornée dans le temps, annulée au premier geste de l'utilisateur.                              | Le `RouterScroller` repose la position un `requestAnimationFrame` après `NavigationEnd`, avant que les ressources d'une page aient rendu leur hauteur. Réessayer est nécessaire, mais reposer un défilement sous quelqu'un qui a déjà commencé à lire est pire que de ne pas restaurer du tout.             |

## Ce que la lecture des sources installées a tranché

`@angular/router@22.0.7`, `RouterScroller` (`fesm2022/_router_module-chunk.mjs:895-975`) :

- La position est **capturée** sur `NavigationStart` via `viewportScroller.getScrollPosition()`.
- Elle n'est **reposée** que si `lastSource === 'popstate'` — donc au retour/avance seulement, jamais sur une navigation ordinaire.
- La repose est différée d'un `setTimeout(0)` **ou** d'un `requestAnimationFrame`, le premier qui vient. C'est toute la fenêtre dont dispose la page pour retrouver sa hauteur : d'où la phase 2.
- `setHistoryScrollRestoration('manual')` est appelé à l'init dès que la restauration est active : le remplaçant doit l'implémenter sous peine de laisser le navigateur restaurer par-dessus.

`@angular/common@22.0.7`, `ViewportScroller` (`types/common.d.ts:846-880`) : cinq méthodes
abstraites — `setOffset`, `getScrollPosition`, `scrollToPosition`, `scrollToAnchor`,
`setHistoryScrollRestoration`.

Aucune route de l'app n'utilise de fragment d'URL : `anchorScrolling: 'enabled'` ne déclenche
donc jamais `scrollToAnchor` aujourd'hui. La méthode doit rester correcte par contrat, mais
elle n'est pas un risque de régression.

## Hors périmètre volontaire

- Ne pas unifier les deux architectures de défilement mobile/desktop. Le défaut ne le demande pas et la fusion toucherait toute la coquille.
- Ne pas restaurer la position à l'intérieur d'une boîte de dialogue ou d'un panneau latéral : le routeur ne navigue pas pour les ouvrir.
- Ne pas ajouter de restauration sur une navigation ordinaire : Angular repose déjà `[0, 0]` et c'est le comportement attendu.
