---
status: done
track: A
---

# Instruction: Le simulateur web réagit pendant la saisie et refuse explicitement le négatif

Le défaut observé vient de deux comportements combinés : l'input n'émet qu'au `blur`/Entrée, puis le
store applique `Math.max(0, amount)` dans `setMonth` et `setGlobalAmount`. Le bouton « Appliquer »
reste donc désactivé pendant la frappe et une valeur négative est silencieusement transformée, ce qui
donne l'impression d'une contribution négative acceptée puis perdue.

Le champ porte déjà `type="number"`, `step="0.01"` et `min="0"` : l'attribut est en place, il
n'empêche simplement pas une valeur négative d'atteindre le store par collage ou saisie clavier. Il
n'y a rien à ajouter de ce côté.

## Architecture ciblée

```text
frontend/projects/webapp/src/app/feature/savings-goals/detail/
├── components/goal-plan-timeline.ts                 ✏️ saisie réactive + erreur visible
├── components/goal-plan-timeline.spec.ts            ✏️ régressions input/bouton
└── services/
    ├── goal-plan-simulator-store.ts                  ✏️ refuser, ne plus clamper
    └── goal-plan-simulator-store.spec.ts             ✏️ invariant montant ≥ 0
```

## Tasks to do

### `1)` Écrire les deux reproductions avant le correctif

1. Modifier un mois de `300` à `400` sans blur : le changement doit atteindre le store et rendre
   « Appliquer » actif immédiatement.
2. Saisir/coller `-500` : l'UI doit rester dans un état invalide explicite, ne pas remplacer la valeur
   par `500` ou `0`, et ne pas rendre le plan applicable.

### `2)` Garder une valeur de saisie locale tant qu'elle n'est pas valide

1. Émettre sur `input`, pas seulement au `change`/blur, avec la même normalisation monétaire que les
   autres formulaires Angular du projet.
2. Conserver le texte temporaire (`''`, `'-'`, décimale incomplète) dans le composant ; n'envoyer au
   calculateur qu'un nombre fini et non négatif.
3. Afficher sous le champ un message qui oriente au lieu de constater : « Le montant doit être
   positif ou nul. Un retrait se crée depuis le budget, pas ici. » Clé transloco dans
   `public/i18n/fr.json`, jamais de chaîne en dur.
4. Retirer `Math.max(0, amount)` de `setMonth` et `setGlobalAmount`. Le store refuse une entrée
   invalide ou conserve le dernier montant valide ; l'UI possède l'erreur.

### `3)` Aligner l'état du bouton

1. `canApply` devient faux si un champ est invalide ou incomplet.
2. Dès qu'une valeur valide diffère du plan initial, « Appliquer (N mois) » s'active sans perte de focus.
3. Entrée et blur restent des gestes de validation compatibles, sans être nécessaires à l'activation.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les tests échouent sur le comportement actuel : pas d'émission avant blur et négatif silencieusement clampé. |
| 2 | La saisie `400` recalcule en direct ; `-500`, `-` et une valeur non finie affichent une erreur et ne mutent pas le plan. |
| 3 | Le bouton s'active pendant la frappe valide et reste désactivé tant qu'un champ est invalide. Appelés directement, `setMonth(-500)` et `setGlobalAmount(-500)` laissent le plan inchangé au lieu d'écrire `0`. |
