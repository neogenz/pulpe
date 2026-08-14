---
objective: "Un revenu prévisionnel peut provenir d'un objectif d'épargne sur web et iOS, sans contribution négative, avec une réalisation atomique, une projection juste et une activité contribution/retrait lisible localement."
status: implemented
---

# Plan: Retraits planifiés depuis un objectif d'épargne

## Overview

| Field | Value |
| --- | --- |
| **Goal** | Corriger les deux défauts reproductibles de la preview, puis permettre de planifier un revenu puisé dans un objectif. |
| **Source** | QA manuelle preview du 5 août 2026, captures et annotation de l'écran de suivi. |
| **Scope** | Contrat partagé, base/API, formules TS/Swift, formulaire de prévision, réalisation, ligne de retrait web/iOS et tests de parcours. |

## Deux pistes, pas une

La QA a produit deux défauts et une frustration. Les défauts se corrigent par un diff
majoritairement négatif et n'ont besoin d'aucun contrat. La frustration (« je n'arrive pas à
saisir un retrait futur, j'ai essayé `-500` dans le simulateur ») est une fonctionnalité
absente, pas un bug — elle demande une migration, deux champs de contrat, un miroir de formule
TS/Swift et deux formulaires. Les livrer ensemble ferait porter à un correctif le risque d'une
feature.

| Constat QA | Nature | Piste |
| --- | --- | --- |
| Le montant saisi n'est pris en compte qu'au blur ; « Appliquer » reste inerte pendant la frappe. | Défaut | A |
| `-500` est silencieusement transformé en `0`, sans erreur. | Défaut | A |
| Cliquer un retrait ouvre le budget **puis** l'éditeur après attente : double transition, web et iOS. | Défaut | A |
| On ne peut pas planifier un revenu puisé dans un objectif. | Fonctionnalité absente | B |
| Contributions et retraits vivent dans deux sections. | Choix de design existant et documenté | Ni A ni B — voir « Hors périmètre » |

**Piste A — correctifs, livrables seuls :** phases 1, 5, 7 puis la porte A de la phase 8.
**Piste B — fonctionnalité, après A :** phases 2, 3, 4, 6 puis la porte B de la phase 8.

Les numéros de phase sont conservés pour ne pas invalider les renvois existants ; l'ordre
d'exécution est celui des pistes.

## Verdict produit

Un retrait n'est pas une « contribution négative ». C'est un mouvement distinct :

1. la **prévision de revenu** annonce qu'un montant sera puisé dans un objectif ;
2. tant qu'elle n'est pas réalisée, elle ne touche pas au solde confirmé ;
3. la **transaction réelle allouée** débite l'objectif atomiquement ;
4. le suivi affiche le retrait avec un signe et un état distincts de ceux d'une contribution.

## Phases

| # | Piste | Phase | File |
| --- | --- | --- | --- |
| 1 | A | Le simulateur web réagit pendant la saisie et refuse explicitement le négatif | [`phase-1.md`](./phase-1.md) |
| 5 | A | Une seule transition à l'ouverture d'un retrait — web | [`phase-5.md`](./phase-5.md) |
| 7 | A | Une seule transition à l'ouverture d'un retrait — iOS | [`phase-7.md`](./phase-7.md) |
| 2 | B | Le contrat « prévision provenant d'un objectif » et sa réalisation atomique | [`phase-2.md`](./phase-2.md) |
| 3 | B | Projection et simulateurs cohérents entre TypeScript et Swift | [`phase-3.md`](./phase-3.md) |
| 4 | B | Ajout et réalisation de la prévision sur le web | [`phase-4.md`](./phase-4.md) |
| 6 | B | Ajout et réalisation de la prévision en SwiftUI | [`phase-6.md`](./phase-6.md) |
| 8 | A + B | Portes de validation, deux gates distincts | [`phase-8.md`](./phase-8.md) |

## Decisions

| Decision | Piste | Why |
| --- | --- | --- |
| Le champ du simulateur possède son erreur ; le store cesse de clamper avec `Math.max(0, …)`. | A | Un clamp silencieux transforme une saisie en une autre valeur sans le dire. C'est exactement ce que la QA a lu comme « contribution négative acceptée puis perdue ». |
| Le message de refus oriente vers le bon geste au lieu de constater l'invalidité. | A | Le `-500` était une tentative de modéliser un retrait ; refuser sans orienter reproduira la tentative. |
| Le clic sur un retrait navigue vers son budget, sans `?transactionId=` ni ouverture automatique d'éditeur. | A | La double transition **est** le workaround : la ligne demande un budget puis attend le chargement de la transaction pour pousser un second écran. Supprimer le paramètre supprime la cause. |
| Aucun composant de détail local n'est créé, ni sur web ni sur iOS. | A | La ligne affiche déjà nom, date et montant ; le budget fournit le contexte. Un détail ne se justifie que si la QA constate que le budget ne suffit pas — décision à prendre après relecture, pas avant. |
| Le retrait garde son rendu **neutre** actuel : `call_made` / `arrow.up.right`, couleur de texte courante, montant signé négatif. | A | `docs/SAVINGS.md` §7 et §10.1 : « vert épargne et neutres, **jamais ambre ou rouge** ». Dans `DESIGN.md`, l'ambre signifie dépense ou dépassement ; un retrait n'est ni l'un ni l'autre. Le signe et le libellé suffisent à porter le sens sans couleur. |
| Ajouter `sourceSavingsGoalId` et `sourceSavingsGoalName` à `budget_line`, séparément de `savingsGoalId`. | B | `savingsGoalId` signifie déjà « contribution vers l'objectif » et n'est valide que pour `kind=saving`. Réutiliser ce champ avec un signe négatif rendrait les invariants ambigus. Les mêmes deux champs existent déjà sur `transaction` (PUL-329) : réutiliser leurs noms et leur sémantique à trois états. |
| Une prévision source est uniquement `kind=income`, `recurrence=one_off` et commence non pointée. | B | Un retrait est ponctuel. Une prévision pointée sans transaction réelle débiterait le pot sans preuve du montant réellement reçu. |
| La source est choisie à la création et immuable en V1. | B | C'est le comportement existant des retraits réels ; modifier l'origine après réalisation compliquerait l'audit et la concurrence. Corriger = supprimer/recréer avant réalisation. |
| La réalisation passe par la transaction allouée existante ; le serveur déduit la source de sa prévision. | B | Le client n'envoie pas deux fois la même origine et l'utilisateur conserve le rapprochement prévu/réel. **Rouvre explicitement un invariant PUL-329** — voir la ligne suivante. |
| Rouvrir l'invariant `transactionCreateSchema` « source + `budgetLineId` interdits ensemble » doit être argumenté dans la phase 2, pas contourné. | B | Le refus actuel est motivé par « allouer la transaction à une prévision ferait double emploi avec les contributions de l'objectif ». Cette raison vise une prévision **de contribution** (`savingsGoalId`), pas une prévision **source**. Le contrat client reste strict, l'héritage reste serveur, mais la phase 2 doit écrire pourquoi les deux cas diffèrent — sinon la relecture le lira comme un contournement. |
| Le serveur interdit de pointer directement une prévision source sans retrait réel correspondant. | B | Cette garde protège aussi les clients anciens et les appels directs API. |
| `confirmé` ne change qu'à la création du retrait réel ; `projeté` retranche le reliquat planifié. | B | On évite de dépenser virtuellement le stock avant réception tout en montrant l'impact futur. |
| Reliquat d'un mois = `max(0, prévu − retraits réels alloués)` ; un réel supérieur au plan reste réel. | B | Pas de double décompte lors de la réalisation, sans masquer un dépassement. |
| Une prévision source n'est combinable ni avec PUL-292 « remettre le mois prochain », ni avec un lissage. | B | Ce sont trois intentions différentes ; les empiler rendrait le formulaire et la comptabilité illisibles. |
| Web et iOS partagent les règles métier, mais iOS reste natif : contrôles SwiftUI, Dynamic Type et VoiceOver. | B | Parité fonctionnelle sans copie pixel à pixel ni navigation contournée. |

## Flux cible (piste B)

```text
Prévision Revenu
  └─ « Provient d'un objectif » + objectif choisi
       ├─ projeté de l'objectif diminue du montant encore non réalisé
       └─ solde confirmé inchangé

Pointer / ajouter le réel
  └─ formulaire de transaction allouée
       └─ création atomique
            ├─ transaction liée à la prévision
            ├─ source héritée de la prévision
            ├─ contrôle du solde confirmé courant
            └─ solde confirmé de l'objectif diminué
```

## Options d'exécution

| Option | Trade-off |
| --- | --- |
| **A puis B (recommandé)** : correctifs livrés seuls, fonctionnalité ensuite. | La preview repart saine en un diff court et négatif ; la feature garde son propre risque, sa migration et sa fenêtre de déploiement. |
| **Tout en une feature, trois checkpoints** : 1–3 contrat/formules, 4–5 web, 6–7 iOS. | Une seule sémantique de bout en bout, mais deux défauts reproductibles restent en preview le temps qu'une migration et un miroir Swift soient prêts. |
| **B seule, sans les correctifs.** | Non retenue : le simulateur continuerait d'avaler `-500` en silence, ce qui est précisément le geste par lequel l'utilisateur cherche la fonctionnalité. |

## Hors périmètre volontaire

- **Fusionner « Contributions » et « Retraits » en une seule chronologie.** Ce n'est pas un
  défaut : `savings-goal-detail-page.ts` porte la décision inverse par écrit (« Section propre,
  jamais fondue dans "Ton suivi" : contributions et retraits vont dans des sens opposés »), et
  les deux flux n'ont ni la même forme (transactions réelles imbriquées d'un côté, plates de
  l'autre) ni le même chargement. La fusion demanderait `budgetMonth`/`budgetYear` sur le wire,
  un tri payDay-aware, deux composants neufs et la suppression de quatre autres. Si elle est
  souhaitée, c'est une décision produit à part, assortie d'une mise à jour de `docs/SAVINGS.md`.
- Pas de montant négatif dans les champs financiers : tous les montants restent positifs sur le
  wire, le type du mouvement porte le signe.
- Pas de retraits récurrents, de retrait depuis plusieurs objectifs, ni de modification de
  source après création.
- Pas de nouveau système générique de transferts : les contrats existants de contribution,
  transaction allouée et retrait sont réutilisés.
- Pas de blocage d'une prévision future sur le seul solde disponible aujourd'hui ; le contrôle
  strict a lieu à la réalisation.
