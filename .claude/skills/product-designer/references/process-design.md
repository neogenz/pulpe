# Methodologie de conception de processus utilisateur

Comment passer d'un besoin humain a un processus metier implementable.

## La chaine de derivation

Chaque feature de Pulpe doit suivre cette chaine logique. Si un maillon manque, le processus est fragile.

```
Douleur humaine (D1-D5)
    ↓
Intention utilisateur (1-11)
    ↓
Processus utilisateur (happy path + frictions)
    ↓
Regles metier (contraintes, validations, etats)
    ↓
Architecture d'information (ecrans, hierarchie, navigation)
    ↓
Specification d'interaction (gestes, transitions, feedback)
    ↓
Implementation (code)
```

**Le Product Designer travaille sur les niveaux 1 a 5.** Le design visuel (niveau 6) releve du design-audit. L'implementation (niveau 7) releve des developpeurs.

## Etape 1 : Ancrer dans le besoin

Avant de concevoir un processus, repondre a ces 3 questions :

1. **Quelle douleur ?** (D1-D5 du BUSINESS_WORKFLOW.md)
2. **Quelle intention ?** (1-11 du BUSINESS_WORKFLOW.md)
3. **Quel moment de vie ?** (contexte physique et emotionnel de l'utilisateur)

Si aucune douleur et aucune intention ne correspondent, le processus n'a pas sa place dans Pulpe.

### Template de contexte utilisateur

```
Qui : [profil — ex: "Maxime, 32 ans, dans le tram"]
Quand : [moment — ex: "dimanche soir apres les courses"]
Etat emotionnel : [ex: "inquiet parce qu'il a beaucoup depense ce weekend"]
Ce qu'il veut : [ex: "savoir s'il peut encore sortir jeudi"]
Ce qu'il fait aujourd'hui sans Pulpe : [ex: "ouvre son Google Sheet, galere a trouver la bonne feuille"]
```

## Etape 2 : Designer le happy path

Le happy path est le parcours ideal quand tout se passe bien. C'est la colonne vertebrale du processus.

### Principes du happy path

1. **Lineaire** : pas de bifurcation, pas de retour en arriere. L'utilisateur avance de A a Z.
2. **Minimum d'etapes** : chaque etape doit etre indispensable. Si on peut la supprimer sans perdre de valeur, on la supprime.
3. **Feedback a chaque etape** : l'utilisateur sait toujours ou il en est et ce qui va suivre.
4. **Sortie gracieuse** : a tout moment, l'utilisateur peut quitter sans perdre de donnees.

### Template de happy path

```
## [Nom du processus]

**Intention** : #X — "[citation]"
**Douleur** : DX — "[citation]"
**Declencheur** : [ce qui declenche le processus — ex: "L'utilisateur ouvre l'app"]

### Etapes

1. [Action utilisateur] → [Feedback systeme]
2. [Action utilisateur] → [Feedback systeme]
3. ...

### Resultat attendu
[Ce que l'utilisateur a obtenu a la fin]
```

## Etape 3 : Identifier les frictions

Pour chaque etape du happy path, poser ces questions :

| Question | Friction potentielle |
|----------|---------------------|
| L'utilisateur doit-il se souvenir de quelque chose ? | Charge memoire → pre-remplir, suggerer |
| L'utilisateur doit-il faire un choix ? | Decision fatigue → reduire les options, defauts intelligents |
| L'utilisateur doit-il saisir du texte ? | Effort physique → autocomplete, raccourcis |
| L'utilisateur peut-il se tromper ? | Risque d'erreur → prevention > correction |
| L'utilisateur doit-il attendre ? | Latence → optimistic UI, skeletons |
| L'utilisateur comprend-il le vocabulaire ? | Jargon → reformuler en langage du quotidien |
| L'action est-elle reversible ? | Anxiete → undo, confirmation contextuelle |

### Matrice friction / solution

| Friction | Cause cognitive | Solution | Principe UX |
|----------|----------------|----------|-------------|
| Trop de champs | Surcharge de choix | Progressive disclosure | Hick |
| Valeurs a deviner | Charge memoire | Champs pre-remplis | Biais du statu quo |
| Vocabulaire technique | Incomprehension | Mots du quotidien | Nielsen #2 (monde reel) |
| Action irreversible | Anxiete | Undo ou confirmation | Nielsen #3 (controle) |
| Pas de feedback | Incertitude | Feedback immediat | Nielsen #1 (visibilite) |
| Trop d'infos | Surcharge cognitive | Hierarchie visuelle + masquage | Miller |
| Actions mal placees | Maladresse | Zone du pouce | Fitts |

## Etape 4 : Traiter les edge cases

Les edge cases sont les situations ou le happy path ne fonctionne pas. Ils revelent la robustesse du processus.

### Edge cases systematiques a verifier

Pour tout processus Pulpe :

- **Premier usage** : l'utilisateur n'a aucune donnee. Que voit-il ? (empty state)
- **Donnees extremes** : montant a 0, montant negatif, montant tres grand
- **Interruption** : l'utilisateur quitte en plein milieu. Que se passe-t-il a son retour ?
- **Erreur reseau** : la requete echoue. Comment on recupere ?
- **Multi-device** : l'utilisateur a commence sur iOS, continue sur web
- **Report negatif** : un mois precedent etait deficitaire. Quel impact sur ce processus ?
- **Budget inexistant** : le mois n'a pas encore de budget. Faut-il le creer automatiquement ?
- **Modele vide** : l'utilisateur n'a pas de modele. Que propose-t-on ?

## Etape 5 : Definir les regles metier

Les regles metier sont les contraintes que le systeme doit respecter. Elles decoulent directement du processus utilisateur.

### Template de regle metier

```
RG-XXX : [Nom court]
- Condition : [quand cette regle s'applique]
- Action : [ce que le systeme fait]
- Consequence : [ce que l'utilisateur voit]
- Justification : [pourquoi cette regle existe — besoin utilisateur]
```

### Validation

Chaque regle metier doit etre tracable :
- Quelle intention utilisateur la motive ?
- Quelle friction previent-elle ?
- Peut-on la simplifier sans degrader l'experience ?

## Etape 6 : Structurer l'information

### Patron "Un ecran = un job"

Chaque ecran de Pulpe doit repondre a exactement un besoin. Si un ecran fait deux choses, il faut probablement le couper en deux.

| Ecran | Job | Hero metric |
|-------|-----|------------|
| Dashboard | "Combien je peux depenser ?" | Disponible a depenser |
| Budget du mois | "Ou en sont mes previsions ?" | Reste par categorie |
| Detail d'une ligne | "Combien j'ai depense sur ce poste ?" | Consomme / Prevu |
| Modele | "A quoi ressemble mon mois type ?" | Equilibre revenus/depenses |
| Vue annuelle | "Comment se profile mon annee ?" | Solde de fin d'annee |

### Hierarchie d'information (3 niveaux)

1. **Niveau 1 (3 secondes)** : le chiffre hero, l'etat emotionnel. Visible sans scroll.
2. **Niveau 2 (10 secondes)** : le resume par categorie, les alertes, les actions rapides.
3. **Niveau 3 (30+ secondes)** : le detail, l'historique, les options avancees. Accessible sur tap/scroll.

### Navigation

Principes de navigation pour l'utilisateur cible :
- **Max 5 onglets** en bottom navigation (iOS) ou side nav (web)
- **Profondeur max 3 niveaux** : liste → detail → sous-detail
- **Retour toujours evident** : back button, swipe back, pas de cul-de-sac
- **Contexte preserve** : si l'utilisateur revient en arriere, il retrouve l'etat qu'il a laisse

## Anti-patterns

### Ce qu'on ne fait JAMAIS dans un processus Pulpe

| Anti-pattern | Pourquoi c'est toxique | Alternative |
|--------------|----------------------|-------------|
| Forcer un tutoriel au premier lancement | Personne ne les lit, ca retarde la valeur | Onboarding contextuel, empty states qui guident |
| Demander une info qu'on pourrait deduire | Friction inutile, l'utilisateur se sent interroge | Deduire, pre-remplir, demander en dernier recours |
| Montrer un ecran vide sans explication | L'utilisateur pense que c'est casse | Empty state avec action suggeree |
| Utiliser des termes techniques | Exclusion, incomprehension | Vocabulaire du quotidien (cf. DA.md) |
| Punir les erreurs | Anxiete, abandon | Expliquer, suggerer, dedramatiser |
| Masquer les consequences | Mauvaises surprises, perte de confiance | Transparence, preview avant action |
| Ajouter des etapes "au cas ou" | Friction, complexite | YAGNI — ajouter quand le besoin est prouve |
| Copier le process d'un concurrent | Pas adapte a la cible ni a la philosophie | Concevoir depuis le besoin, pas depuis la concurrence |
