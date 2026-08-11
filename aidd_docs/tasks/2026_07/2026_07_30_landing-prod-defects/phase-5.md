---
status: done
---

# Instruction: Champ ambiant cohérent desktop/mobile

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── landing/
    └── app/
        └── globals.css                 ✏️ baisse le chroma des 7 gradients desktop du body
```

## Tasks to do

### `1)` Baisser le chroma des gradients desktop

> Aujourd'hui desktop est un drench vert plein page sur 7215px, mobile est quasi neutre. La même page livre deux marques.

1. Réduire le chroma des tokens `--ambient-leaf`, `--ambient-mint`, `--ambient-lime` consommés par les 7 `radial-gradient` de `body` (`globals.css:64-102`), à environ 55 à 65 pour cent de la valeur actuelle.
2. Rester en OKLCH et ne modifier que le chroma : la teinte et la clarté portent l'identité, c'est la saturation qui fait le drench.
3. Ne pas monter l'opacité mobile. Le `0.07` de `globals.css:357` est calibré par différence de pixels contre un rendu flouté, écart moyen sous 1,7/255 : c'est une valeur mesurée, pas un oubli.
4. Ne pas ajouter ni retirer de gradient : le nombre de couches n'est pas le sujet de cette phase.

### `2)` Vérifier que rien ne bascule sous AA

> Le champ passe sous du texte secondaire sur toute la hauteur de la page.

1. Recalculer le contraste du texte secondaire sur les pics du champ après baisse : la mesure actuelle donne 7,81:1 et 6,84:1, la baisse de chroma les fait monter, il suffit de confirmer qu'aucune paire ne descend.
2. Confirmer que le détecteur reste à 0 finding : les valeurs modifiées vivent dans `@theme`, elles doivent y rester.

### `3)` Comparer les deux breakpoints côte à côte

> Le critère de sortie, c'est que desktop et mobile racontent la même marque.

1. Capturer le hero et une section de milieu de page à 1440px et à 390px, et vérifier que l'écart d'intensité perçu s'est resserré.
2. Vérifier qu'aucun bord dur de gradient n'apparaît là où le fondu était masqué par la saturation.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | À 1440px, le champ vert reste perceptible mais ne domine plus la surface de la page                        |
| 1    | La règle mobile `background-image: none` et l'opacité `0.07` des halos sont inchangées                      |
| 2    | Aucun texte ne descend sous 4,5:1, et 0 finding au détecteur                                               |
| 3    | Le hero à 1440px et à 390px se lisent comme la même marque, sans écart d'intensité brutal                   |
| 3    | Aucun bord dur ni bande visible n'apparaît dans les fondus                                                  |
