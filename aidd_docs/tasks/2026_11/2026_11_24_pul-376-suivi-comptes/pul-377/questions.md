# Questions ouvertes : PUL-377

## Q1. CA13 : quelle « indication » du rapprochement ?

Sous un compte suivi, le rapprochement (web `reconcile-accounts-step.ts`, iOS `ReconcileAccountsSheet+AccountLink.swift`) affiche seulement « Mis à jour dans Mon patrimoine. », sans montant. Aucune indication de valeur n'existe à mettre à jour.

Choix prudent retenu : l'indication donne la valeur à jour, en restant une indication (pas un préremplissage, pour que le solde tapé vienne de la banque) : « Mis à jour dans Mon patrimoine, où il vaut aujourd'hui 10 500.00 CHF. ». À confirmer.

## Q2. CA17 : conversion relancée ou trigger ?

La note technique décrit une conversion idempotente « relancée après la bascule ». Une migration ne s'exécute qu'une fois et la relance demanderait une étape manuelle sur la base de production.

Choix retenu : la migration convertit les écartements existants et ajoute un trigger qui fait la même copie à chaque écartement écrit par l'ancien backend pendant la bascule. Résultat identique (CA17), sans étape manuelle. Le trigger devient inactif quand plus rien n'écrit `suggestion_dismissed_at` ; il se retire avec la colonne.

## Q3. Désarchiver : les pointages faits pendant l'archivage comptent d'un coup

Un élément archivé garde sa dernière saisie. Si je pointe une Prévision liée pendant son archivage puis que je le désarchive, ce pointage (fait après la dernière saisie) s'ajoute à sa valeur au moment du désarchivage. Aucun CA ne couvre ce cas.

Choix retenu : garder ce comportement. La règle reste « dernière saisie + ce que j'ai pointé depuis », sans exception à expliquer, et « Modifier » permet de corriger. À confirmer.

## Q4. Fenêtre de déploiement : nouveau web, ancienne API

Le web (Vercel) et l'API (Railway) partent du même merge mais pas au même instant. `recordedValue` est requis dans `assetSchema` : si le nouveau web sert avant la nouvelle API, la page Mon patrimoine (derrière le flag `net_worth`) échoue à lire la réponse jusqu'au déploiement de l'API, puis revient seule au rechargement. Les apps iOS installées ne sont pas touchées : elles ignorent `recordedValue`.

Choix retenu : ne rien ajouter. Rendre le champ facultatif demande une transformation au niveau de l'objet qui casse la composition du schéma, pour une fenêtre de quelques minutes sur une page derrière un flag. À confirmer, ou déployer l'API avant le web pour cette release.
