# Review: Restaurer la position de défilement au retour arrière

- **Verdict**: ship
- **Diff**: `bfd826cd3...05013cef9` (re-review du correctif `05013cef9` sur la passe `…70a1dd30a`)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_06 (passe 1), 2026_08_06 (re-review)
- **Findings**: 0 critical, 0 warning, 3 minor

## Phases

### Phase 1 — La position se lit et se repose sur le conteneur qui défile vraiment

- [x] À 1280 px, la position revient au lieu de 0 — `page-viewport-scroller.ts:59-66` résout `<main>` par son `overflow-y` calculé, `:72-80` et `:138-145` lisent/écrivent dessus ; `RouterScroller` capture sur `NavigationStart` et rejoue le tuple identique (`@angular/router/fesm2022/_router_module-chunk.mjs:925`, `:948`, store en mémoire, aucune sérialisation)
- [x] À 375 px, aucune régression — `<main>` n'a pas `overflow-y-auto` sous `isHandset()` (`layout/main-layout.ts:457`), donc conteneur `null` et repli sur `win.scrollTo({...options, left, top})`, identique octet pour octet à `BrowserViewportScroller` (`@angular/common/fesm2022/common.mjs:133-139`) — **désormais couvert par deux tests** (spec `:81-95` écriture, `:97-108` lecture)
- [x] Aucune surface collante n'a bougé — le diff ne touche ni template ni style : `git diff --stat bfd826cd3 05013cef9` = `core.ts`, `routing/index.ts`, `page-viewport-scroller.ts`, `page-viewport-scroller.spec.ts`
- [x] Un lien interne ordinaire ouvre la page en haut — `_router_module-chunk.mjs:954` appelle `scrollToPosition([0,0])`, écrit tel quel sur `<main>` par `page-viewport-scroller.ts:138-145`
- [x] `pnpm test` passe, et le spec échoue si le service lit la fenêtre — `npx vitest run …/page-viewport-scroller.spec.ts` : 12/12 ; le cas `:58-64` assert `[0,250]`, une lecture fenêtre rendrait `[0,0]`

### Phase 2 — La restauration attend que la page ait retrouvé sa hauteur

- [x] Page froide, position retrouvée une fois les données affichées — `page-viewport-scroller.ts:170-191` réessaie à chaque `requestAnimationFrame` ; spec `:138-148` prouve 100 → 1528 après `growTo(2000)`. Le plafond de 1 000 ms est **retenu et justifié**, voir la note W2 ci-dessous
- [x] Deux retours enchaînés laissent la page au dernier — `:86` annule avant d'écrire ; spec `:177-187`
- [x] Un geste utilisateur gagne — `GESTURE_EVENTS` `:23-28`, abandon `:175-177` ; spec `:150-162`
- [x] Une navigation ordinaire n'arme aucun réessai — garde `#isOrigin` `:90`, `:155-157` ; spec `:189-199`. La garde est maintenant **inconditionnellement** vraie pour `[0,0]` : `scrollToPosition` ne touche plus à `#offset`
- [x] `pnpm test` passe, et le spec échoue si l'abandon écoute `scroll` — le stub émet un `scroll` sur `window` à chaque écriture (spec `:35`) et les écouteurs sont posés sur `win` (`:207-209`) : ajouter `'scroll'` à `GESTURE_EVENTS` ferait tomber le cas `:138-148`

## Findings

| Sev | Kind | Phase | Location | Issue | Statut |
| --- | ---- | ----- | -------- | ----- | ------ |
| ✅ | code | 1 | `page-viewport-scroller.ts:82-93` | `scrollToPosition` retranchait l'offset là où `BrowserViewportScroller` écrit la position telle quelle | **Corrigé, structurellement.** `#offset` n'est plus lu que par `scrollToAnchor` (`:99` — seule occurrence hors définition et `setOffset`, grep vérifié). Le piège n'est donc plus dormant, il est hors d'atteinte : quel que soit l'offset posé demain, `scrollToPosition([0,0])` écrit `[0,0]`, `#isOrigin` reste vrai, aucune boucle armée. Le cas de spec a suivi le bon chemin (`:110-117` verbatim, `:119-136` soustraction sur ancre) |
| ✅ | fit | 2 | `page-viewport-scroller.ts:7` | `SETTLE_TIMEOUT_MS = 1000` jugé trop court pour un « réseau ralenti » | **Retiré — mon finding était une assertion, pas une mesure.** L'auteur a mesuré 82–299 ms sur cette pile, trois appels parallèles de ~90 ms sur le détail d'objectif. Deux arguments que je n'avais pas pesés vont dans le même sens : (a) le retour arrière est le cas **cache chaud** par construction — les stores passent par `cachedResource` (SWR, `ngx-ziflux/README.md:101`), qui sert l'entrée en cache sur le même tick ; la hauteur est disponible sans attendre le réseau ; (b) rallonger la fenêtre élargit d'autant le trou que le commentaire `:13-21` documente lui-même — un défilement qui n'émet aucun événement d'entrée est contrarié pendant toute la durée du timeout. 1 000 ms est un choix cohérent, je l'accepte |
| ✅ | code | 1 | `page-viewport-scroller.spec.ts:81-108` | La branche « pas de conteneur » n'était jamais exercée | **Corrigé.** Les deux tests interrogent bien le service et pas le stub : `:81-95` échoue si `#writePosition` cesse de retomber sur la fenêtre ou change la charge utile ; `:97-108` échoue si `getScrollPosition` lit autre chose que `scrollX`/`scrollY` (lire `pageYOffset` rendrait `0` en jsdom, pas `340`). Résiduel accepté : la sortie de boucle « cible atteinte » reste non couverte sur le chemin fenêtre, mais `#reachedTarget` est du code partagé déjà couvert côté conteneur |
| ✅ | code | 2 | `page-viewport-scroller.ts:9-22` | `GESTURE_EVENTS` ne documentait pas ce qu'il laisse passer | **Corrigé.** Le commentaire nomme les cas non couverts et donne la raison de ne pas resserrer la garde (collision avec le *scroll anchoring* de Chrome, actif exactement dans la fenêtre que la boucle existe pour couvrir). Réserve : le cas que j'avais soulevé — le glissement d'ascenseur natif — n'est pas nommé ; le commentaire suppose implicitement qu'il émet un `pointerdown`, ce qui reste non prouvé. Sans conséquence : la phrase « bounded by `SETTLE_TIMEOUT_MS` » le couvre quand même |
| 🟢 | code | 2 | `page-viewport-scroller.ts:170-191` | La boucle ne vérifie pas que le conteneur visé existe encore ; si la coquille se démonte en vol (redirection de session vers `/login`), `#writePosition` bascule sur `window` | **Toujours ouvert, non traité.** Plafond d'impact faible : la page d'authentification tient dans la fenêtre, donc l'écriture est ramenée à 0 par le navigateur et rien ne se voit — sauf petit écran clavier ouvert. Ne bloque pas |
| 🟢 | rot | 1 | `frontend/projects/webapp/src/app/core/core.ts:128-131` | Le commentaire du provider redit en quatre lignes ce que le bloc de classe explique déjà (`page-viewport-scroller.ts:30-43`) | **Toujours ouvert, non traité** — le correctif ne touche pas `core.ts` |
| 🟢 | code | 1 | `frontend/projects/webapp/src/app/core/routing/page-viewport-scroller.spec.ts:97-108` | **Nouveau.** `Object.defineProperty(window, 'scrollX'/'scrollY', …)` n'est jamais défait : les valeurs `12`/`340` fuient sur tous les cas suivants du fichier. Sans dégât aujourd'hui (les cas suivants passent par un `<main>`, et `:119-121` les remet à 0), mais c'est l'anti-pattern que `.claude/rules/07-quality-assurance/testing-vitest.md` nomme explicitement (« Share mutable state between tests → Reset in `beforeEach` ») | Ouvert. `vi.spyOn(window, 'scrollX', 'get').mockReturnValue(12)` se restaure tout seul et supprime la fuite |

### Note sur le `try/catch` ajouté à `setHistoryScrollRestoration` (`:125-136`)

Accepté, avec la divergence signalée. Angular attrape la même exception mais **avertit** (`console.warn(_formatRuntimeError(2400, …))`, `@angular/common/fesm2022/common.mjs:149-155`) ; cette version est silencieuse. Défendable : le seul effet observable d'un échec est que `history.scrollRestoration` reste `'auto'`, ce qui laisse le navigateur restaurer le défilement de la **fenêtre** — sur desktop c'est `<main>` qui défile, donc sans effet, et sur mobile cela double une écriture que `RouterScroller` fait déjà. Le mode de défaillance est bénin et le commentaire explique pourquoi la garde existe. Aucun chemin de production de cette app n'entre dans un iframe sandboxé.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (10/10 critères d'acceptation)               |
| Files checked | `core/core.ts`, `core/routing/page-viewport-scroller.ts`, `core/routing/page-viewport-scroller.spec.ts`, plus les sources de référence `@angular/common/fesm2022/common.mjs`, `@angular/router/fesm2022/_router_module-chunk.mjs`, `ngx-ziflux/README.md`, `layout/main-layout.ts` |
| Unchecked     | none                                              |
| Unplanned     | none                                              |
| Tests         | `npx vitest run` (frontend) : 208 fichiers, 2679 tests, 0 échec, **exit 0** — voir la section ci-dessous |

### État de la suite, vérifié dans cette passe

`npx vitest run > log 2>&1; echo "FULL_RUN_EXIT=$?"` → `FULL_RUN_EXIT=0`, `Test Files 208 passed (208)`, `Tests 2679 passed (2679)`, **zéro occurrence de « Unhandled »** dans les 6 172 lignes du journal. Deux exécutions complètes consécutives, même résultat.

L'erreur non rattrapée que j'avais signalée sur `core/file-download.spec.ts` **ne se reproduit pas** : 5 exécutions isolées du fichier, 3/3 tests verts à chaque fois, aucun « Unhandled ». Sept tentatives au total sans reproduction — soit elle dépendait de la charge machine au moment du démontage du worker (le spec stubbe `URL.createObjectURL` et `HTMLAnchorElement.prototype.click`, dont le nettoyage court après la fin des tests), soit ma passe précédente l'a mal attribuée. Elle n'est en tout cas pas un blocage, et le fichier n'est pas flaky sur les mesures disponibles.

Note de méthode : `${PIPESTATUS[0]}` est un bashisme — sous zsh la variable s'appelle `pipestatus` et est indexée à partir de 1, donc un `echo "EXIT=${PIPESTATUS[0]}"` derrière un pipe affiche une chaîne vide et ne prouve rien. Le code de sortie ci-dessus vient d'un `$?` pris directement sur `npx vitest run`.
