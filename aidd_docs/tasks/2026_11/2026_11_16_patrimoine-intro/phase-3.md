---
status: done
---

# Instruction: Web : dialog d'explication

## Architecture projection

```txt
.
└── frontend/
    └── projects/
        └── webapp/
            ├── public/
            │   └── i18n/
            │       ├── fr.json ✏️
            │       ├── en.json ✏️
            │       ├── de.json ✏️
            │       └── it.json ✏️
            └── src/
                └── app/
                    ├── core/
                    │   └── storage/
                    │       ├── storage-keys.ts ✏️
                    │       └── storage-schemas.ts ✏️
                    └── feature/
                        └── net-worth/
                            ├── net-worth-page.ts ✏️
                            ├── net-worth-page.spec.ts ✏️
                            ├── components/
                            │   ├── net-worth-intro.model.ts ✅
                            │   ├── net-worth-intro.model.spec.ts ✅
                            │   ├── net-worth-intro-dialog.ts ✅
                            │   └── net-worth-intro-dialog.spec.ts ✅
                            └── services/
                                └── net-worth-dialog.service.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Supabase local lancé (`cd backend-nest && supabase start`, depuis le dépôt principal si un autre worktree l'utilise déjà) et backend `pnpm dev:backend` sur :3000 ; compte du seed, dont le patrimoine est vide (`seed.sql` ne crée aucun avoir) ; `frontend/.env` présent ; `localStorage` sans `pulpe-net-worth-intro-seen` ; `pulpe-dev-feature-flags` = `{"version":1,"data":{"net_worth":true},"updatedAt":""}` ; compte de démo | Page `/net-worth` accessible | browser |
| Happy path | Ouvrir `/net-worth` | La dialog s'ouvre une fois les données chargées, étape 1 animée, `viewed` avec `source=auto` | browser |
| Setup | Patrimoine rempli : à jouer après le scénario « patrimoine vide », qui se termine par l'ajout d'un compte via le formulaire, ce qui donne l'état rempli des scénarios suivants | Une ligne dans le patrimoine | browser |
| Happy path | « Suivant » ×2 puis « Compris » | Fermeture, `completed` `action=close`, clé `pulpe-net-worth-intro-seen` à `true` ; recharger ne la rouvre pas | browser |
| Edge case | Patrimoine vide, dernière étape | « Ajouter mon premier compte » ferme la dialog puis ouvre `AssetFormDialog` | browser |
| Edge case | Échap ou clic hors dialog à l'étape 1 | `skipped` `step=0`, clé à `true` | browser |
| Edge case | Clic sur « ? » | Dialog à l'étape 1, `source=help` | browser |
| Edge case | `prefers-reduced-motion: reduce` | Aucune transition de déplacement, valeurs finales affichées directement | browser |
| Edge case | Viewport mobile (375 × 812) | Dialog plein écran, comme `AssetFormDialog` ; la scène passe sur une colonne ; le bouton principal reste visible en bas | browser |
| Edge case | Téléphone en paysage (812 × 375) | Le contenu défile dans la dialog, les boutons restent atteignables | browser |
| Edge case | Desktop (1280 × 800) | Dialog centrée de 560 px, scène sur deux colonnes à l'étape 1 | browser |
| Edge case | Navigation au clavier | Tab atteint « Plus tard » puis le bouton principal, Entrée avance, Échap ferme ; le focus revient sur « ? » à la fermeture | browser |
| Edge case | Chargement en erreur | Pas de dialog | browser |
| Teardown | Supprimer la clé `localStorage` et le compte ajouté | État de départ | browser |

## Wireframe

```txt
┌─────────────────────────────────────┐
│ (1) Mon patrimoine         [?] [+]* │
├─────────────────────────────────────┤
│        page actuelle inchangée       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ (2)                       Plus tard │
├─────────────────────────────────────┤
│ (3) Scène animée                     │
│  ┌───────────────────────────────┐  │
│  │ Compte courant      3 200     │  │
│  │ Épargne            12 000     │  │
│  │ Placements          8 000     │  │
│  │ Voiture             9 000     │  │
│  │ ─────────────────────────     │  │
│  │ Tout ce que j'ai   32 200     │  │
│  └───────────────────────────────┘  │
│ (4) Titre de l'étape                 │
│     Texte court, 2 lignes max        │
│ (5)          ● ○ ○                   │
│ (6) [        Suivant          ]      │
└─────────────────────────────────────┘

┌───────────────────┐
│ (7)     Plus tard │
├───────────────────┤
│ ┌───────────────┐ │
│ │ Compte courant│ │
│ │ Épargne       │ │
│ │ Placements    │ │
│ │ Voiture       │ │
│ └───────────────┘ │
│ Titre             │
│ Texte             │
│      ● ○ ○        │
│ [   Suivant   ]   │
└───────────────────┘
```

1. En-tête de la page : bouton « ? » ajouté avant « Ajouter », visible sur l'état vide et l'état rempli (pas en chargement ni en erreur). `*` : « Ajouter » reste masqué sur l'état vide, comme aujourd'hui.
2. Fermeture « Plus tard », masquée à la dernière étape.
3. Scène (carte marquée « Exemple ») : étape 1, quatre éléments éparpillés (Compte courant, Épargne, Placements, Voiture, chacun avec son icône) glissent et se rangent dans une seule carte « Tout ce que j'ai », le total monte jusqu'à 32 200 (défilement sur iOS et Android, fondu sur le web) ; étape 2, « Ce que j'ai 32 200 » et « Ce que je dois · Crédit −6 000 », la dette grignote la barre en ambre, puis un bloc vert foncé « Ma fortune nette 26 200 » apparaît en rebond ; étape 3, la ligne « Épargne · Mis à jour il y a 2 mois · 12 000 » reçoit un appui sur le crayon, passe à 12 500 et « Mis à jour aujourd'hui », la fortune nette passe à 26 700, puis une mention en pointillé « 500 mis de côté dans ton budget → je te propose +500 ici. » apparaît.
4. Titre et texte de l'étape (copie ci-dessous).
5. Indicateur d'étape, 3 points.
6. Bouton principal : « Suivant » aux étapes 1 et 2 ; à l'étape 3, « Ajouter mon premier compte » si le patrimoine est vide, sinon « Compris ».
7. Téléphone (Handset) : dialog plein écran, scène sur une colonne, contenu qui défile, points et bouton principal collés en bas.

Copie (FR, validée par `slopcheck-fr` : 0 BLOCK, 0 WARN ; à traduire en en, de, it) :
- Étape 1 : « Tout ton argent, au même endroit » / « Comptes, épargne, placements, mais aussi ta voiture ou ton appart : ajoute tout ce que tu possèdes. »
- Étape 2 : « Ta situation en un coup d'œil » / « J'enlève ce que tu dois, crédit ou leasing. Il reste un chiffre : ta fortune nette, l'état réel de tes finances. »
- Étape 3 : « Garde-la à jour en un geste » / « Une valeur change ? Tu la mets à jour. Et quand tu mets de l'argent de côté dans ton budget, je te propose de l'ajouter ici. »

## Tasks to do

### `1)` Clé « déjà vue »

> Même mécanique que `FIRST_TRANSACTION_RECORDED`.

1. `NET_WORTH_INTRO_SEEN: 'pulpe-net-worth-intro-seen'` dans `STORAGE_KEYS`, schéma `z.boolean()`, `scope: 'user'`.

### `2)` Modèle pur

> Toute la logique de l'intro, testable sans rendu.

1. `net-worth-intro.model.ts` : `INTRO_STEPS = ['overview', 'netWorth', 'update'] as const` ; `INTRO_SAMPLE` (avoirs : compte courant 3 200, épargne 12 000, placements 8 000, voiture 9 000 ; dette : crédit 6 000 ; mise à jour : épargne 12 000 → 12 500 ; suggestion budget 500) ; `introTotals(sample)` calcule « tout ce que j'ai », la fortune nette avant et après la mise à jour ; `primaryAction(step, isEmpty)` rend `'next' | 'done' | 'add'`.
2. `net-worth-intro.model.spec.ts` : totaux 32 200 / 26 200 / 26 700, action par étape et par état vide.

### `3)` Composant dialog

> Standalone, OnPush, signaux ; la vue affiche le modèle et n'additionne rien.

1. `NetWorthIntroDialog` : `MAT_DIALOG_DATA` = `{ source, isEmpty, currency }`, `step = signal(0)`, `action = computed(() => primaryAction(...))`, ferme avec `'add' | 'close' | undefined`.
2. Une branche `@switch (step())` par étape : le DOM de l'étape est recréé, donc ses animations CSS rejouent sans état d'animation à gérer.
3. Animations dans les `styles` du composant, sans dépendance : convergence des lignes (translate + rotate, décalées), barre de dette (`scaleX` depuis la droite), bloc fortune nette (rebond), appui sur le crayon, fondu enchaîné des valeurs. Pas de compteur qui défile sur le web (ponytail : pas de tween JS pour une dialog vue une fois). `@media (prefers-reduced-motion: reduce)` remplace tout par un fondu court.
4. Responsive : `mat-dialog-content` défile ; scène `grid-cols-1 sm:grid-cols-2` à l'étape 1 ; rangée d'actions qui passe à la ligne ; aucun `vh` ni largeur fixe hors du conteneur de 560 px.
5. Accessibilité : la scène est `aria-hidden`, une phrase `sr-only` par étape la décrit ; titre d'étape en `h2` relié par `aria-labelledby` ; « Plus tard » et le bouton principal sont de vrais `button`.
6. Analytics via `AnalyticsService.captureEvent` : `viewed` à l'init, un seul `completed` ou `skipped` (`afterClosed` couvre Échap et backdrop).
7. Libellés : `netWorth.gross`, `netWorth.debts`, `netWorth.heroTitle` réutilisés ; nouvelles clés `netWorth.intro.*` (aide, plus tard, suivant, compris, ajouter mon premier compte, exemple, titres et textes des 3 étapes, libellés d'échantillon, « mis à jour il y a 2 mois », « mis à jour aujourd'hui », mention du budget) dans fr, en, de, it.
8. Spec : navigation des étapes, libellé du CTA selon `isEmpty`, un seul événement de fin, focus rendu au bouton « ? ».

### `4)` Brancher dans la page

> Ouverture auto une fois, puis via « ? ».

1. `NetWorthDialogService.openIntro(data)` : plein écran sur `Breakpoints.Handset`, `560px` sinon, comme `#openForm`.
2. Dans `NetWorthPage`, un `effect` ouvre la dialog quand le statut quitte `loading` sans erreur et que la clé est absente ; la clé est écrite à la fermeture.
3. Bouton icône « ? » (`help_outline`, `aria-label` « Comprendre mon patrimoine ») dans l'en-tête, placé hors du `@if (!store.isEmpty())` qui garde « Ajouter » ; masqué en chargement et en erreur.
4. Résultat `'add'` → `onAdd()`.
5. Spec de page : étendre le mock `dialogs` avec `openIntro` et fournir un `StorageService` simulé ; tester l'ouverture auto unique, l'absence d'ouverture si la clé existe, le bouton « ? » à l'état vide.
6. Vérifier dans le navigateur (dev-browser) : première visite, rechargement, « ? », CTA vide, 375 × 812, 812 × 375, 1280 × 800, clavier, `prefers-reduced-motion`, thème sombre.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | La clé est lue et écrite via `StorageService` et validée par son schéma |
| 2 | `net-worth-intro.model.spec.ts` passe : 32 200 / 26 200 / 26 700 et la bonne action par étape |
| 3 | `net-worth-intro-dialog.spec.ts` passe : étapes, CTA vide ou rempli, un seul événement de fin ; la dialog tient sans défilement horizontal de 375 à 1280 px de large |
| 4 | `net-worth-page.spec.ts` passe ; dans le navigateur, première visite → dialog, rechargement → rien, « ? » → dialog, CTA vide → formulaire |
