# Objectifs d'épargne — cas d'usage et alignement

> **Ce document n'est pas la source de vérité métier.** Les formules, le chiffrement et les
> invariants vivent dans [`docs/SAVINGS.md`](../../../../docs/SAVINGS.md). Ce qui suit est une
> autre coupe : **scénario par scénario, ce que l'utilisateur attend, ce que le produit fait
> aujourd'hui, et ce qui le prouve**. C'est la grille d'alignement avant d'écrire des tests.
>
> Colonne **État** : ✅ conforme · ⚠️ divergence connue · 🔨 en cours · ❓ à trancher

---

## 1. L'objet

Un objectif d'épargne est un **nom**, une **cible** optionnelle, une **échéance** optionnelle, un
**statut**, et un **montant de départ** optionnel déjà mis de côté avant le suivi.

Ce qui le distingue d'une simple Prévision Épargne, et qui ne dépend d'aucune cible :

1. le lien survit aux régénérations mensuelles (porté par `template_line`, pas seulement par le mois) ;
2. le cumul dans le temps, en deux couches — **prévu** et **épargné** ;
3. la timeline mois par mois et la trajectoire.

Une **contribution** n'est jamais une nouvelle saisie : c'est une Prévision Épargne existante
rattachée à l'objectif. Aucun geste supplémentaire, aucune priorité, aucune sollicitation.

---

## 2. Cas d'usage

### UC1 — Créer un objectif

| # | Scénario | Attendu | État |
|---|---|---|---|
| 1.1 | Je crée « Canapé », cible 3'700, échéance 12.10.2026 | L'objectif existe, actif, à 0 % | ✅ |
| 1.2 | Je déclare 930 déjà épargnés | Le montant de départ compte dans l'épargné et le %, jamais dans le rythme | ✅ |
| 1.3 | Pulpe me propose une mensualité | `(cible − départ) ÷ mois restants`, échéance et mois courant inclus, arrondi au centime supérieur | ✅ |
| 1.4 | J'accepte la mensualité | Une Prévision Épargne récurrente liée est posée sur le Mois Type et propagée aux budgets **jusqu'à l'échéance** | ✅ depuis PUL-311 |
| 1.5 | Je refuse la mensualité | L'objectif est créé nu, je rattacherai moi-même | ✅ |
| 1.6 | Je n'ai pas de Mois Type par défaut | L'objectif est créé quand même, sans ligne, sans erreur | ✅ |
| 1.7 | Le mois courant n'a pas de budget rattaché au Mois Type par défaut | ❓ La mensualité a été calculée en comptant ce mois : elle ne couvrira pas la cible | ⚠️ |
| 1.8 | Je crée un objectif **sans échéance** | Possible ; pas de rythme requis, la page bascule sur la période d'atteinte estimée | 🔨 PUL-314 |
| 1.9 | Je crée un objectif **sans cible** — un pot | Possible ; ni %, ni barre, ni « atteint » : l'épargné, le prévu cumulé, la projection du prévu restant | 🔨 PUL-314 |
| 1.10 | Mon montant de départ dépasse déjà la cible | Complétion **suggérée**, jamais appliquée d'office | ✅ |

### UC2 — Rattacher une épargne à un objectif

| # | Scénario | Attendu | État |
|---|---|---|---|
| 2.1 | Je rattache depuis l'éditeur du **Mois Type**, avec propagation | Tous les mois futurs **jusqu'à l'échéance**, et pas au-delà | ⚠️ écrit partout aujourd'hui — 🔨 PUL-312 |
| 2.2 | Je rattache une Prévision **d'un mois précis** | Ce mois seul, sans toucher au Mois Type | ✅ |
| 2.3 | Je rattache rétroactivement un mois passé | Accepté ; la contribution compte | ✅ |
| 2.4 | Je détache (`savingsGoalId = null`) | Le lien saute, la Prévision reste, aucune borne ne s'applique | ✅ |
| 2.5 | Je change le type d'une Prévision liée vers non-Épargne | Le lien est forcé à null ; la progression re-filtre de toute façon | ✅ |
| 2.6 | Je veux répartir une épargne entre deux objectifs | Impossible par conception : une Prévision = un objectif, créer deux Prévisions distinctes | ✅ |
| 2.7 | Un budget manuellement ajusté | Protégé (RG-001) : la propagation ne l'écrase pas | ✅ |
| 2.8 | Un nouveau mois est généré | Le lien est recopié depuis le Mois Type, **jusqu'à l'échéance** | ✅ depuis PUL-311 |

### UC3 — Suivre la progression

| # | Scénario | Attendu | État |
|---|---|---|---|
| 3.1 | Je regarde où j'en suis | **Épargné** = montant de départ + Prévisions liées **pointées** | ✅ |
| 3.2 | Je regarde ce que j'ai engagé | **Prévu cumulé** = somme brute des montants liés des mois écoulés, sans enveloppe transactions | ✅ |
| 3.3 | Le pourcentage | Sur l'**épargné**, jamais sur le prévu — on n'a atteint que ce qui est réellement de côté | ✅ |
| 3.4 | Je veux savoir si je tiens le rythme | Rythme requis = `(cible − épargné) ÷ mois restants` ; statut avec 5 % de tolérance | ✅ |
| 3.5 | Mon rythme est insuffisant | Affiché **neutre**, jamais rouge ni ambre : un objectif en retard n'est pas une erreur (RG-002) | ✅ |
| 3.6 | Sans échéance | Ni rythme requis, ni statut, ni projection à l'échéance — la période d'atteinte estimée les remplace | 🔨 PUL-314 |
| 3.7 | Sans cible | Ni %, ni barre, ni écart — l'épargné, le prévu cumulé, la projection du prévu restant | 🔨 PUL-314 |
| 3.8 | Je pointe un mois futur en avance | Accepté ; l'épargné peut dépasser le prévu cumulé | ✅ |

### UC4 — Lire le plan mois par mois

| # | Scénario | Attendu | État |
|---|---|---|---|
| 4.1 | J'ouvre « Ton plan » | Une ligne par période, de l'ancrage à l'échéance | ✅ |
| 4.2 | Un mois sans Prévision liée | Affiché comme trou, montant à 0 | ✅ |
| 4.3 | Un mois passé, ou entièrement pointé | Verrouillé, non éditable | ✅ |
| 4.4 | Un mois sans budget, provisionnable | Signalé comme tel, seulement si le Mois Type porte une ligne liée et que la période ne dépasse pas l'échéance | ✅ |
| 4.5 | Des Prévisions existent au-delà de l'échéance | La timeline les montre — elle est fidèle, elle ne masque pas | ✅ par conception |
| 4.6 | Sans échéance | La timeline s'étend jusqu'à la dernière Prévision liée | 🔨 PUL-314 |

### UC5 — Ajuster le plan

| # | Scénario | Attendu | État |
|---|---|---|---|
| 5.1 | Je simule un montant mensuel global | Local, appliqué aux seuls mois ouverts, rien n'est écrit | ✅ |
| 5.2 | J'ajuste un mois précis | Idem, et le mois devient épinglé | ✅ |
| 5.3 | « Réajuster la suite » | Le reste réparti au centime sur les mois ouverts non épinglés | ✅ |
| 5.4 | J'applique | Récapitulatif obligatoire, puis écriture atomique ; les montants appliqués deviennent manuels | ✅ |
| 5.5 | Je quitte ou j'annule | Rien n'est persisté | ✅ |
| 5.6 | Un mois est pointé pendant ma simulation | Conflit signalé, je relis et resimule | ✅ |
| 5.7 | Sans cible | Il n'y a pas de reste à répartir — le simulateur doit le refléter, pas diviser dans le vide | 🔨 PUL-314 |

### UC6 — Changer le statut

| # | Scénario | Attendu | État |
|---|---|---|---|
| 6.1 | Je mets en pause | La génération des mois suivants s'arrête ; aucun jugement de rythme | ✅ |
| 6.2 | Je reprends | La génération repart pour les budgets suivants ; les mois manqués ne sont **pas** rétro-remplis | ✅ |
| 6.3 | Mon épargné atteint la cible | Pulpe **propose** de terminer, ne le fait jamais seul | ✅ |
| 6.4 | Je termine ou je mets en pause avec des Prévisions futures | On me propose : garder en déliant, ou supprimer. Jamais de mois passé ni de ligne pointée | ✅ |
| 6.5 | Je ré-ouvre un objectif terminé | Réversible, la génération reprend | ✅ |
| 6.6 | Sans cible, il n'y a rien à atteindre | ❓ Que devient « marquer terminé » ? | ❓ |

### UC7 — Modifier l'objectif

| # | Scénario | Attendu | État |
|---|---|---|---|
| 7.1 | Je renomme, je change la cible | Appliqué ; aucun montant recalculé en silence | ✅ |
| 7.2 | Je **recule** l'échéance | Appliqué ; rien n'est rétro-rempli sur les mois ajoutés | ✅ |
| 7.3 | J'**avance** l'échéance | On me propose quoi faire des Prévisions au-delà — garder en déliant, ou supprimer | ⚠️ ne fait rien aujourd'hui — 🔨 PUL-313 |
| 7.4 | Je retire l'échéance | La borne saute, les Prévisions déjà écrites ne bougent pas | 🔨 PUL-314 |
| 7.5 | Mon échéance est dépassée | L'objectif **reste actif**. Affichage factuel, CTA « repousser la date », jamais rouge | ✅ |

### UC8 — Supprimer l'objectif

| # | Scénario | Attendu | État |
|---|---|---|---|
| 8.1 | Je supprime | Les Prévisions liées survivent, simplement déliées. Aucune donnée financière perdue | ✅ |

---

## 3. Règles transverses

| Règle | Énoncé |
|---|---|
| **Couleur (RG-002)** | L'épargne est un objectif à atteindre, pas un risque. En retard ou dépassé = neutre. Le rouge est réservé au déficit global du mois. |
| **Jamais de silence** | Pulpe ne recalcule, ne redistribue et ne supprime aucun montant sans confirmation explicite. |
| **Deux couches** | Prévu = ce que tu as prévu de mettre. Épargné = ce qui est réellement de côté. Ne jamais les confondre : le % est sur l'épargné. |
| **Périodes** | Tout raisonnement mensuel suit le jour de paie, pas le calendrier. Un objectif échéant le 12.10 avec paie au 27 appartient au cycle « 27 sept – 26 oct ». |
| **Une Prévision, un objectif** | Pas de répartition d'une ligne entre plusieurs objectifs. |
| **Devise** | Devise du compte. Pas de conversion en v1. |
| **Chiffrement** | Cible et montants sont chiffrés au repos ; jamais journalisés. |
| **Horizon** | Une Prévision liée n'existe jamais sur une période postérieure à l'échéance — **quelle que soit la surface** qui l'a créée. C'est l'invariant que PUL-312 rend unique. |

---

## 4. Divergences ouvertes

| # | Divergence | Suite |
|---|---|---|
| D1 | Rattacher depuis le Mois Type ignore l'échéance | 🔨 [PUL-312](https://linear.app/pulpe/issue/PUL-312) |
| D2 | Avancer l'échéance ne réconcilie rien | 🔨 [PUL-313](https://linear.app/pulpe/issue/PUL-313) |
| D3 | Impossible de créer un objectif sans cible ni échéance | 🔨 [PUL-314](https://linear.app/pulpe/issue/PUL-314) |
| D4 | L'auto-décomposition écrit dans les budgets **déjà matérialisés** du Mois Type par défaut, sans en provisionner aucun ni vérifier combien ont été touchés — la mensualité peut donc ne pas couvrir la cible, sans que rien ne le signale au moment de la création | **pas de ticket** |
| D5 | Le lissage d'une Prévision liée et le reset depuis le Mois Type peuvent écrire au-delà de l'échéance | assumé : gestes explicites, période par période |
| D6 | Les Prévisions écrites au-delà d'une échéance avant PUL-311 ne sont pas nettoyées | assumé : cohérent avec « jamais de suppression rétroactive » |

## 5. À trancher

| # | Question |
|---|---|
| Q1 | **D4** : si le mois courant n'a pas de budget sur le Mois Type par défaut, faut-il le provisionner, réduire la mensualité aux mois réellement atteints, ou simplement le dire à l'utilisateur ? |
| Q2 | **UC6.6** : un objectif sans cible peut-il être « terminé » ? Si oui, sur quel déclencheur, puisqu'il n'y a rien à atteindre ? |
| Q3 | Un objectif sans cible **ni** échéance peut-il être mis en pause ? La pause sert à arrêter la génération, ce qui garde du sens — à confirmer. |
| Q4 | L'échéance dépassée laisse l'objectif actif et propose « repousser la date ». Avec PUL-314, faut-il aussi proposer « retirer l'échéance » ? |
