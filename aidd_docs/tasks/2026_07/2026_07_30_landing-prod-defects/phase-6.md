---
status: done
---

# Instruction: Lot de correctness

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── landing/
    ├── app/
    │   └── globals.css                 ✏️ mesure des blocs de prose, palier 15px de l'échelle
    └── components/
        ├── sections/
        │   ├── Platforms.tsx           ✏️ retire ou active le glow mort
        │   └── WhyFree.tsx             ✏️ ramène la prose fondateur sous 75ch
        └── ui/
            ├── AccordionItem.tsx       ✏️ ramène les réponses FAQ sous 75ch
            └── HeroDashboard.tsx        ✏️ aria-label sur un div, marge de contraste
```

## Tasks to do

### `1)` Supprimer le glow mort de Platforms

> `Platforms.tsx:37` utilise `bg-lime/15`, aucun token `--color-lime` n'existe, la classe compile à zéro règle.

1. Vérifier d'abord que la classe est bien absente du CSS compilé, la mesure actuelle donne 0 occurrence.
2. Trancher entre deux issues, sans laisser un troisième état ambigu : soit retirer le `div` décoratif, soit exprimer le glow avec un token existant du `@theme`.
3. Ne pas introduire un token `--color-lime` pour ce seul usage : le champ ambiant a déjà `--ambient-lime`, c'est un doublon en attente.

### `2)` Corriger l'aria-label sur un div

> axe le remonte en `serious`, needs review : `HeroDashboard.tsx:52` porte un `aria-label` sur un `div` sans role valide.

1. Soit donner à l'élément un role qui accepte un nom accessible, soit déplacer le libellé sur une structure qui en porte un nativement, soit le retirer si le contenu est déjà décrit.
2. Vérifier après coup que le nombre d'items axe needs review a baissé, et que les violations restent à 0.

### `3)` Élargir la marge de contraste du dashboard

> `text-white/80` sur l'extrémité claire du dégradé donne 4,73:1, soit AA franchi de 0,23.

1. Passer les libellés concernés de `HeroDashboard.tsx` à `text-white/90`, ce qui porte le ratio autour de 5,6:1 sans coût visuel.
2. Vérifier les trois occurrences de 12px et 14px sur le dégradé, pas seulement la première.

### `4)` Ramener la prose sous 75ch

> `landing/DESIGN.md` §3 vise 65 à 75ch. Les réponses FAQ mesurent ~91ch, la prose fondateur ~86ch.

1. Réduire la contrainte de largeur des réponses dans `AccordionItem.tsx` et de la prose dans `WhyFree.tsx`.
2. Mesurer après coup plutôt que de supposer : la cible est la fourchette 65 à 75ch, pas une classe Tailwind particulière.
3. Ne pas toucher aux blocs déjà dans la fourchette, mesurés entre 64 et 74ch.

### `5)` Fermer le palier 15px de l'échelle

> 16px, 15px et 14px cohabitent sans différence fonctionnelle, ratio 1,07.

1. Fusionner le 15px de `arrow-note-label` (`globals.css:200`) dans le palier 14px existant.
2. Vérifier que le libellé de la flèche tient toujours sur une ligne, il porte un `white-space: nowrap`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 1    | Aucune classe utilitaire de la page ne compile à zéro règle                                            |
| 2    | axe ne remonte plus l'item `aria-prohibited-attr`, et les violations restent à 0                        |
| 3    | Aucun texte du dashboard ne descend sous 5:1                                                           |
| 4    | Les réponses FAQ et la prose fondateur mesurent entre 65 et 75ch à 1440px                               |
| 5    | La page n'expose plus trois tailles de corps de texte séparées par moins de 1,1                        |
| 5    | Le libellé de la flèche tient sur une ligne à 390px                                                    |
