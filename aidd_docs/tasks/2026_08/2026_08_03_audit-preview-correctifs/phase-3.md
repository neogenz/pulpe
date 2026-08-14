---
status: done
---

# Instruction: Ce que l'écran dit (webapp)

Trois endroits où l'écran tait ce qu'il sait : une origine d'épargne qu'aucun lecteur d'écran n'entend, une chute de cumul sans ligne pour l'expliquer, et un bouton grisé sans motif.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp
├── public/i18n/fr.json                                        ✏️ le motif du choix d'objectif manquant
└── src/app
    ├── ui/savings-goal-source
    │   ├── savings-goal-source-line.ts                        ✏️ le texte visible redevient le nom accessible
    │   └── savings-goal-source-line.spec.ts                   ✏️ affirmer le texte exposé, pas la présence d'un attribut
    ├── feature/savings-goals/detail/components
    │   ├── goal-plan-timeline.ts                              ✏️ garder les mois qui ne portent qu'un retrait
    │   └── goal-plan-timeline.spec.ts                         ✏️ un mois fermé aux contributions mais porteur d'un retrait reste listé
    └── pattern/savings-goal-picker
        ├── savings-goal-picker-field.ts                       ✏️ dire pourquoi l'envoi est bloqué tant qu'aucun objectif n'est choisi
        └── savings-goal-picker-field.spec.ts                  ✏️ l'état « options présentes, rien de choisi » affiche son motif
```

## Wireframe

```txt
┌──────────────────────────────────────────────┐
│ (1) Détail d'objectif — timeline              │
│  ┌────────────────────────────────────────┐  │
│  │ juin 2026   · versé 300      cumul 3000 │  │
│  │ (2) août    · retiré 4500    cumul -1500│  │
│  │ sept 2026   · versé 0        cumul -1500│  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│ (3) Formulaire — revenu depuis un objectif    │
│  [x] Ce revenu vient d'un objectif d'épargne  │
│  ┌────────────────────────────────────────┐  │
│  │ Objectif  [ choisir…            ▾ ]     │  │
│  │ (4) motif du blocage                    │  │
│  └────────────────────────────────────────┘  │
│                        [ Ajouter (grisé) ]    │
└──────────────────────────────────────────────┘
```

1. Timeline de l'objectif, une ligne par mois du plan.
2. Le mois porteur du retrait, aujourd'hui filtré : c'est lui qui explique la chute du cumul.
3. Le formulaire d'ajout, section retrait dépliée.
4. L'emplacement du motif quand des objectifs existent mais qu'aucun n'est choisi.

## Tasks to do

### `1)` Rendre l'origine d'épargne audible

> Le `truncate` est purement visuel — la mécanique d'`aria-label` ne sert à rien et coûte le nom accessible.

1. Retirer l'`aria-label` posé sur le `<span>` générique (ARIA y interdit le nommage) et le `aria-hidden` qui masque l'unique texte.
2. Reprendre le spec pour affirmer le texte exposé plutôt que la présence de l'attribut.
3. Vérifier le cas où le composant est l'unique contenu d'un lien dans le formulaire d'édition : le lien doit désormais annoncer un nom.

### `2)` Laisser voir le mois qui explique la chute

> Le calculateur émet exprès ces lignes ; seule la webapp les jette.

1. Élargir le filtre de la timeline pour garder un mois inéligible aux contributions dès qu'il porte un retrait.
2. Libeller ces lignes depuis leur propre `withdrawnAmount`, en tenant compte de l'avertissement du calculateur : la première ligne cumule les retraits antérieurs à la fenêtre, le libellé dit donc « retiré jusqu'ici », pas « retiré ce mois-ci ».
3. Respecter la règle de formatage : ce sont des agrégats, donc `'1.0-0'`.

### `3)` Dire pourquoi l'envoi est bloqué

> Aujourd'hui : des objectifs existent, aucun n'est choisi, le bouton est grisé et rien ne l'explique.

1. Marquer le `mat-select` requis et afficher le motif dans l'état « options présentes, rien de choisi » ; l'emplacement est déjà réservé par `subscriptSizing="dynamic"`.
2. Ajouter la clé dans `fr.json`, sans symbole de devise dans la chaîne.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Un lecteur d'écran annonce l'origine complète de l'épargne, et le lien du formulaire d'édition porte un nom.               |
| 2    | Un objectif dont un retrait tombe après l'échéance affiche ce mois dans sa timeline, avec le montant retiré ; le cumul ne chute plus entre deux lignes sans explication. |
| 3    | Objectif non choisi alors que des options existent : un motif s'affiche sous le sélecteur, le bouton reste grisé.          |
| 1-3  | `pnpm test` passe dans `frontend`, `pnpm quality` reste vert.                                                              |
