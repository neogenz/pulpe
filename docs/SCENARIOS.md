# Scénarios métier — Web App

> Référentiel des use cases métier pour tests E2E, cahiers de tests QA, et validation fonctionnelle.
>
> **Principes** : Chaque scénario décrit un workflow utilisateur de bout en bout.
> Les critères d'acceptation portent sur le **résultat métier visible**, pas sur le DOM ou la structure des pages.
> Un scénario qui ne précise pas de critères signifie qu'ils sont implicites dans le workflow (chaque étape doit être possible).

---

## 1. Authentification & Sécurité

### 1.1 Créer un compte par email

**Workflow** : Page d'accueil > Cliquer sur "Créer un compte" > Remplir email et mot de passe > Valider > Créer un code PIN (vault code) > Confirmer le code PIN > Copier/sauvegarder la clé de secours > Confirmer avoir sauvegardé la clé > Arriver sur l'écran d'onboarding (complétion du profil)

### 1.2 Créer un compte via Google OAuth

**Workflow** : Page d'accueil > Cliquer sur "Continuer avec Google" > Authentification Google > Créer un code PIN (vault code) > Confirmer le code PIN > Sauvegarder la clé de secours > Arriver sur l'écran d'onboarding

### 1.3 Se connecter par email

**Workflow** : Page de login > Remplir email et mot de passe > Valider > Saisir son code PIN > Arriver sur le mois courant

**Critères** :
- L'utilisateur voit le dashboard de son mois courant
- Ses données financières sont affichées (déchiffrées via le code PIN)

### 1.4 Se connecter via Google OAuth

**Workflow** : Page de login > Cliquer sur "Continuer avec Google" > Authentification Google > Saisir son code PIN > Arriver sur le mois courant

### 1.5 Se souvenir de l'appareil

**Workflow** : Écran de saisie du code PIN > Cocher "Se souvenir de cet appareil" > Saisir le code > Valider > Se déconnecter > Se reconnecter > Le code PIN n'est pas redemandé

**Critères** :
- La clé est stockée en `localStorage` (persiste entre sessions)
- Sans la case cochée, la clé est en `sessionStorage` (perdue à la fermeture)

### 1.6 Mot de passe oublié

**Workflow** : Page de login > Cliquer "Mot de passe oublié" > Saisir son email > Recevoir le lien de réinitialisation > Cliquer le lien > Saisir un nouveau mot de passe > Saisir sa clé de secours > Valider > Recevoir une nouvelle clé de secours > Se connecter avec le nouveau mot de passe

### 1.7 Code PIN oublié — Récupération par clé de secours

**Workflow** : Écran de saisie du code PIN > Cliquer "Code perdu ?" > Saisir sa clé de secours > Créer un nouveau code PIN > Confirmer > Recevoir une nouvelle clé de secours > Arriver sur le mois courant

**Critères** :
- La clé de secours est formatée automatiquement (majuscules, groupes séparés)
- Le nouveau code PIN fonctionne pour les connexions suivantes
- L'ancienne clé de secours ne fonctionne plus

### 1.8 Se déconnecter

**Workflow** : Menu utilisateur (coin supérieur droit) > Cliquer "Se déconnecter" > Être redirigé vers la page de login

**Critères** :
- La session est nettoyée (vault key supprimée de sessionStorage)
- Les routes protégées ne sont plus accessibles
- Si "Se souvenir" était coché, la clé localStorage est conservée

### 1.9 Déconnexion multi-onglets

**Workflow** : Avoir l'app ouverte dans 2 onglets > Se déconnecter dans l'onglet 1 > Rafraîchir l'onglet 2

**Critères** :
- L'onglet 2 redirige vers la page de login après rafraîchissement

### 1.10 Protection des routes

**Workflow** : Accéder directement à une URL protégée (ex: `/app/dashboard`) sans être connecté

**Critères** :
- Redirection vers la page d'accueil/welcome
- Aucune donnée sensible n'est accessible

---

## 2. Onboarding

### 2.1 Compléter son profil (premier budget)

**Workflow** : Écran de complétion du profil > Étape 1 : saisir son prénom et son revenu mensuel > Étape 2 : saisir le jour de paie + charges mensuelles optionnelles (loyer, assurance, téléphone, internet, transport, leasing) > Valider > Être redirigé sur le mois courant

**Critères** :
- Un modèle "Mois standard" est créé et visible dans la liste des modèles
- Un budget du mois courant est créé à partir de ce modèle
- Le dashboard du mois courant affiche les données du budget créé
- Le revenu saisi apparaît comme ligne de revenu
- Les charges saisies apparaissent comme dépenses récurrentes

### 2.2 Utilisateur existant avec budget — pas d'onboarding

**Workflow** : Se connecter avec un compte qui a déjà un budget

**Critères** :
- L'utilisateur est redirigé directement sur le mois courant (pas de complétion de profil)

---

## 3. Mode démo

### 3.1 Lancer le mode démo

**Workflow** : Page de login ou d'accueil > Cliquer "Essayer la démo" > Validation Turnstile > Arriver sur le mois courant avec des données de démonstration

**Critères** :
- Les données affichées sont réalistes (revenus, dépenses, épargne)
- Le code PIN n'est pas demandé
- La section sécurité est masquée dans les réglages
- La session expire après 24h

---

## 4. Modèles de budget (Templates)

### 4.1 Voir la liste des modèles

**Workflow** : Menu de navigation > Aller sur la page des modèles

**Critères** :
- Le compteur affiche le nombre de modèles sur le maximum (ex: "1 modèle(s) sur 3 maximum")
- Le modèle par défaut est identifiable

### 4.2 Créer un modèle

**Workflow** : Page des modèles > Cliquer "Créer un modèle" > Saisir un nom > Ajouter des lignes de revenus > Ajouter des lignes de dépenses (récurrentes) > Ajouter des lignes d'épargne > Optionnellement cocher "Modèle par défaut" > Valider

**Critères** :
- Le modèle apparaît dans la liste
- Le nom doit être unique
- Le bouton de création est désactivé si le maximum (3) est atteint

### 4.3 Consulter les détails d'un modèle

**Workflow** : Page des modèles > Cliquer sur un modèle

**Critères** :
- Le solde net est affiché (revenus - dépenses - épargne)
- Les totaux par catégorie sont affichés (pilules : revenus, dépenses, épargne)
- Toutes les lignes de prévisions sont listées dans un tableau

### 4.4 Modifier les lignes d'un modèle

**Workflow** : Détails du modèle > Ouvrir l'édition des prévisions > Ajouter/modifier/supprimer des lignes > Choisir le mode de propagation : "Modèle uniquement" OU "Propager aux budgets futurs" > Valider

**Critères** :
- Si "Modèle uniquement" : seul le modèle est modifié, les budgets existants ne changent pas
- Si "Propager aux futurs" : le modèle ET les budgets futurs non ajustés manuellement sont mis à jour
- Les lignes marquées `is_manually_adjusted` dans les budgets ne sont jamais modifiées par la propagation
- Le nombre de budgets affectés est indiqué avant validation

### 4.5 Supprimer un modèle

**Workflow** : Détails du modèle > Cliquer supprimer > Confirmer

**Critères** :
- Si le modèle est utilisé par des budgets : un message affiche les budgets liés et empêche la suppression
- Si le modèle n'est utilisé nulle part : suppression après confirmation
- Le modèle disparaît de la liste

---

## 5. Budgets mensuels

### 5.1 Voir le calendrier des budgets

**Workflow** : Menu de navigation > Aller sur la page des budgets

**Critères** :
- Les mois de l'année sont affichés sous forme de calendrier
- Les mois avec un budget existant sont distincts des mois vides
- Le mois courant est mis en évidence
- On peut naviguer entre les années (année courante + 7 futures)

### 5.2 Créer un budget pour un mois

**Workflow** : Page des budgets (calendrier) > Cliquer sur un mois vide > Remplir la boîte de dialogue : choisir un modèle (optionnel), ajouter une description > Valider

**Critères** :
- Le budget est créé et le mois apparaît comme "occupé" dans le calendrier
- Si un modèle est sélectionné, les lignes du modèle sont copiées dans le budget
- Un seul budget par mois par utilisateur

### 5.3 Consulter les détails d'un budget

**Workflow** : Page des budgets > Cliquer sur un mois avec budget OU naviguer depuis le mois courant

**Critères** :
- L'en-tête affiche la période (ex: "janvier 2026")
- Les totaux sont affichés : revenus, dépenses (récurrentes + prévues), épargne, disponible à dépenser
- Les lignes de prévisions sont regroupées par catégorie : revenus, dépenses récurrentes, dépenses prévues, épargne
- Pour chaque ligne : nom, montant, consommation (dépensé/restant), statut coché/non coché
- La navigation vers le budget précédent/suivant est possible

### 5.4 Ajouter une ligne de prévision (dépense)

**Pré-requis** : Noter les valeurs avant : total dépenses, reste, solde final.

**Workflow** : Détails du budget > Ajouter une prévision > Saisir nom = "Test dépense", montant = 50, type = Dépense, fréquence = Prévu > Valider

**Critères** :
- La ligne "Test dépense" apparaît dans la catégorie "Dépenses prévues"
- Le total des dépenses augmente de 50
- Le reste diminue de 50
- Le solde final diminue de 50

### 5.5 Modifier une ligne de prévision

**Pré-requis** : La ligne "Test dépense" à 50 CHF créée en 5.4. Noter le reste avant.

**Workflow** : Détails du budget > Cliquer éditer sur "Test dépense" > Changer le montant de 50 à 80 > Sauvegarder

**Critères** :
- Le montant affiché passe à 80
- Le reste diminue de 30 supplémentaires (différence 80 - 50)
- La ligne est marquée comme `is_manually_adjusted` (ne sera plus affectée par la propagation du modèle)
- Un indicateur de verrouillage apparaît si la ligne est liée à un modèle

### 5.6 Supprimer une ligne de prévision

**Pré-requis** : La ligne "Test dépense" à 80 CHF. Noter le reste et le solde final avant.

**Workflow** : Détails du budget > Cliquer supprimer sur "Test dépense" > Confirmer la suppression

**Critères** :
- La ligne disparaît de la liste
- Le total des dépenses diminue de 80
- Le reste remonte de 80
- Le solde final remonte de 80
- Les valeurs reviennent à celles d'avant le 5.4 (état initial restauré)

### 5.7 Cycle de vie complet d'une transaction allouée

> Scénario de bout en bout. Chaque étape vérifie l'impact sur l'enveloppe ET sur le reste global.

**Pré-requis** : Un budget avec au moins une enveloppe de dépense (ex: "Courses" à 200 CHF).
Noter les valeurs initiales : montant enveloppe, dépensé enveloppe, reste global.

**Workflow** :

1. **Ouvrir l'enveloppe** : Cliquer sur l'enveloppe "Courses" > Le dialog des transactions s'ouvre
   - Critère : le résumé affiche Prévu / Dépensé / Reste de l'enveloppe

2. **Ajouter une transaction** : Ajouter "Migros" à 30 CHF > Valider
   - Critère : "Dépensé" de l'enveloppe augmente de 30
   - Critère : la barre de progression de l'enveloppe avance
   - Critère : le reste global du budget diminue de 30

3. **Ajouter une deuxième transaction** : Ajouter "Coop" à 45 CHF > Valider
   - Critère : "Dépensé" de l'enveloppe = 75 (30 + 45)
   - Critère : le reste global a diminué de 75 au total par rapport à l'initial

4. **Cocher une transaction** : Cocher "Migros"
   - Critère : la transaction apparaît cochée visuellement
   - Critère : le compteur de transactions cochées s'incrémente

5. **Modifier une transaction** : Éditer "Coop", changer le montant de 45 à 60 > Valider
   - Critère : "Dépensé" de l'enveloppe = 90 (30 + 60)
   - Critère : le reste global reflète le changement (-15 supplémentaires)

6. **Décocher la transaction** : Décocher "Migros"
   - Critère : retour à l'état non coché, compteur décrémenté

7. **Supprimer une transaction** : Supprimer "Coop" > Confirmer
   - Critère : "Dépensé" de l'enveloppe = 30 (seule "Migros" reste)
   - Critère : le reste global remonte de 60

8. **Supprimer la dernière transaction** : Supprimer "Migros" > Confirmer
   - Critère : "Dépensé" de l'enveloppe = 0
   - Critère : le reste global revient à la valeur initiale

### 5.8 Comptabiliser une enveloppe — Dialog de cascade

**Pré-requis** : Une enveloppe avec au moins une transaction allouée NON cochée.

**Workflow** :

1. **Cocher l'enveloppe parent** (la ligne de prévision, pas la transaction) > Un dialog apparaît : "Comptabiliser les transactions ?"
2. **Choisir "Oui, tout comptabiliser"** > L'enveloppe ET toutes ses transactions passent à cochées
   - Critère : toutes les transactions de l'enveloppe sont cochées
   - Critère : l'enveloppe elle-même est cochée

3. **Décocher l'enveloppe** > Pas de dialog
   - Critère : seule l'enveloppe est décochée, les transactions restent cochées

4. **Re-cocher l'enveloppe** > Le dialog réapparaît (car il n'y a pas de transactions non cochées cette fois) OU ne réapparaît pas si toutes sont déjà cochées
   - Critère : si toutes les transactions sont déjà cochées, pas de dialog, l'enveloppe se coche directement

5. **Décocher manuellement les transactions** > Puis recocher l'enveloppe > Le dialog réapparaît

**Variante : refuser la cascade** :

1. **Cocher l'enveloppe parent** > Dialog apparaît
2. **Choisir "Non, juste l'enveloppe"** > Seule l'enveloppe est cochée
   - Critère : les transactions allouées restent non cochées
   - Critère : l'enveloppe est cochée

### 5.9 Cocher/décocher une enveloppe sans transactions

**Workflow** : Détails du budget > Cocher une enveloppe qui n'a aucune transaction allouée

**Critères** :
- Pas de dialog de cascade (rien à cascader)
- L'enveloppe passe à cochée directement
- Décocher fonctionne sans dialog également

### 5.10 Cocher une transaction n'affecte pas le parent

**Workflow** : Ouvrir une enveloppe avec plusieurs transactions > Cocher toutes les transactions une par une

**Critères** :
- Même quand toutes les transactions sont cochées, l'enveloppe parent ne se coche PAS automatiquement
- Le cochage est toujours un choix explicite de l'utilisateur

### 5.11 Affichage des enveloppes — badge et montant dépensé

**Pré-requis** : Une enveloppe "Courses" à 200 CHF, sans transactions allouées.

**Workflow** :

1. **État initial** : l'enveloppe affiche "0 / 200" (ou équivalent) et pas de badge de transactions
2. **Ajouter une transaction** de 50 CHF > Valider
   - Critère : le badge affiche "1" (1 transaction allouée)
   - Critère : le texte "dépensé" de l'enveloppe passe à 50 / 200
3. **Ajouter une deuxième transaction** de 30 CHF > Valider
   - Critère : le badge affiche "2"
   - Critère : le texte "dépensé" passe à 80 / 200
4. **Supprimer une transaction** (la 30 CHF)
   - Critère : le badge revient à "1"
   - Critère : le texte "dépensé" revient à 50 / 200
5. **Supprimer la dernière transaction**
   - Critère : le badge disparaît (ou affiche "0")
   - Critère : le texte "dépensé" revient à 0 / 200

### 5.12 Exporter les budgets en JSON

**Workflow** : Page des budgets (calendrier) > Cliquer sur le bouton d'export JSON

**Critères** :
- Un fichier `.json` est téléchargé contenant tous les budgets de l'utilisateur

### 5.13 Exporter les budgets en Excel

**Workflow** : Page des budgets (calendrier) > Cliquer sur le bouton d'export Excel

**Critères** :
- Un fichier `.xlsx` est téléchargé contenant tous les budgets de l'utilisateur

### 5.14 Rechercher des transactions

**Workflow** : Page des budgets (calendrier) > Ouvrir la recherche > Saisir un terme > Voir les résultats

**Critères** :
- Les résultats affichent les transactions correspondantes à travers tous les budgets
- Cliquer sur un résultat navigue vers le budget concerné

---

## 6. Mois courant (Dashboard)

### 6.1 Voir le tableau de bord du mois courant

**Workflow** : Menu de navigation > Aller sur le mois courant (ou être redirigé après connexion)

**Critères** :
- Le mois affiché correspond à la période en cours (basée sur le jour de paie si configuré)
- La barre de progression du budget est visible (dépenses vs disponible)
- Les dépenses récurrentes sont listées
- Les dépenses prévues (one-off) sont listées
- Les transactions libres du mois sont listées

### 6.2 Ajouter une transaction rapide

**Workflow** : Mois courant > Cliquer sur le bouton FAB (+) > Saisir nom, montant, type > Valider

**Critères** :
- La transaction apparaît dans la liste des transactions du mois
- Le montant "restant" est mis à jour immédiatement

### 6.3 Modifier une transaction depuis le mois courant

**Workflow** : Mois courant > Cliquer éditer sur une transaction > Modifier les informations > Sauvegarder

**Critères** :
- Les modifications sont sauvegardées
- Les totaux sont recalculés

### 6.4 Supprimer une transaction depuis le mois courant

**Workflow** : Mois courant > Cliquer supprimer sur une transaction > Confirmer

**Critères** :
- La transaction disparaît
- Les totaux sont recalculés

### 6.5 Cocher/décocher une entrée financière

**Workflow** : Mois courant > Cliquer sur la case à cocher d'une entrée (prévision ou transaction)

**Critères** :
- Le statut visuel change
- Sur le dashboard, pas de dialog de cascade (comportement simplifié par rapport aux détails du budget)

---

## 7. Calculs & Règles métier

> **Deux métriques distinctes** à vérifier :
>
> | Métrique | Calcul | Items pris en compte |
> |----------|--------|---------------------|
> | **Reste / Solde final** | `Disponible - totalDépenses` | Toutes les lignes et transactions (cochées ou non) |
> | **Solde réalisé** | `RevenusCoché - DépensesCochées` | Uniquement les items cochés |
>
> Formules de référence :
> ```
> Disponible = totalRevenus + rollover
> Reste = Disponible - totalDépenses (avec logique enveloppe)
> Solde final (endingBalance) = Reste
> Rollover mois M+1 = endingBalance mois M
> Premier mois : rollover = 0
>
> totalDépenses (enveloppe) = pour chaque enveloppe: max(montant_enveloppe, somme_transactions_allouées)
>                           + somme des transactions libres
>
> Solde réalisé = pour chaque enveloppe cochée: max(montant_enveloppe, somme_transactions_cochées)
>               + pour chaque enveloppe non cochée: somme_transactions_cochées seulement
>               + transactions libres cochées
> ```

### 7.1 Vérification du calcul "Disponible à dépenser"

**Workflow** : Ouvrir les détails d'un budget > Noter les valeurs affichées

**Critères** :
- `Disponible` = somme de toutes les lignes de revenu + report du mois précédent
- `Reste` = Disponible - somme des dépenses (récurrentes + prévues) - somme de l'épargne
- Le premier budget de l'utilisateur a un report de 0

### 7.2 Impact d'un ajout de dépense sur le solde final

**Workflow** : Sur un budget du mois M > Noter le solde final > Ajouter une enveloppe de dépense de 100 CHF > Attendre le recalcul

**Critères** :
- Le solde final du mois M diminue de 100
- Le "Reste" diminue de 100

### 7.3 Impact sur le rollover du mois suivant

**Pré-requis** : Deux budgets consécutifs (mois M et mois M+1).

**Workflow** :

1. **Noter les valeurs initiales** : solde final de M, report de M+1, disponible de M+1
2. **Sur le mois M** : ajouter une enveloppe "Test Rollover" de 100 CHF (dépense)
3. **Vérifier le mois M** : le solde final a diminué de 100
4. **Naviguer vers le mois M+1** : vérifier que le report a aussi diminué de 100
5. **Vérifier le mois M+1** : le "Disponible" a diminué de 100 (car report diminué)
6. **Nettoyage** : retourner au mois M, supprimer "Test Rollover"
7. **Vérifier** : le solde final de M et le report de M+1 reviennent aux valeurs initiales

### 7.4 Calcul des enveloppes — impact sur le Reste global

> Le Reste utilise `max(montant_enveloppe, total_toutes_transactions)` — indépendamment du statut coché.

**Pré-requis** : Une enveloppe de dépense à 200 CHF. Noter le Reste global.

**Workflow** :

1. **Ajouter une transaction** de 80 CHF dans l'enveloppe
   - Critère : "Dépensé" de l'enveloppe = 80 / 200
   - Critère : le Reste global **ne change PAS** (80 < 200, l'enveloppe couvre)
2. **Ajouter une deuxième transaction** de 80 CHF
   - Critère : "Dépensé" = 160 / 200
   - Critère : le Reste global **ne change toujours PAS** (160 < 200)
3. **Ajouter une troisième transaction** de 100 CHF (total = 260, dépasse l'enveloppe)
   - Critère : "Dépensé" = 260 / 200
   - Critère : le Reste global diminue de **60** (uniquement la partie excédentaire : 260 - 200)
4. **Supprimer la 3ème transaction** (retour à 160)
   - Critère : le Reste global revient à sa valeur d'avant (plus de dépassement)

### 7.5 Solde réalisé — enveloppe comptabilisée sans dépassement

> Règle : quand une enveloppe est cochée, le solde réalisé compte `max(montant_enveloppe, total_transactions_cochées)`.
> Le `consumed` ne prend en compte que les transactions **cochées**.

**Pré-requis** : Une enveloppe de dépense à 2000 CHF, sans transactions. Noter le solde réalisé initial.

**Workflow** :

1. **Ajouter une transaction** de 100 CHF dans l'enveloppe
2. **Ajouter une deuxième transaction** de 900 CHF dans l'enveloppe
   - Critère : "Dépensé" de l'enveloppe = 1000 / 2000
3. **Cocher l'enveloppe** via le dialog "Comptabiliser les transactions ?" > **Choisir "Oui, tout comptabiliser"**
   - Critère : le solde réalisé compte **2000** (pas 1000, ni 2000 + 1000)
   - Explication : `max(2000, 1000) = 2000`, l'enveloppe couvre

**Variante** : Cocher l'enveloppe **sans cascader** (choisir "Non, juste l'enveloppe")
   - Critère : le solde réalisé compte **2000** aussi (`max(2000, 0) = 2000` car aucune transaction n'est cochée)

### 7.6 Solde réalisé — enveloppe comptabilisée avec dépassement

> Règle : quand les transactions cochées dépassent l'enveloppe, c'est le total coché qui est compté.

**Pré-requis** : Continuer depuis 7.5 (enveloppe 2000 CHF, transactions 100 + 900).

**Workflow** :

1. **Ajouter une troisième transaction** de 2000 CHF dans l'enveloppe
   - Critère : "Dépensé" de l'enveloppe = 3000 / 2000 (dépassement de 1000)
2. **Cocher l'enveloppe** via le dialog > **"Oui, tout comptabiliser"** (les 3 transactions + l'enveloppe sont cochées)
   - Critère : le solde réalisé compte **3000** (pas 2000)
   - Explication : `max(2000, 3000) = 3000`, le réel dépasse la prévision

**Attention** : Si on coche l'enveloppe **sans cascader les transactions** (elles restent non cochées), le solde réalisé compte **2000** (`max(2000, 0) = 2000`). Il faut que les transactions soient cochées pour que le dépassement apparaisse dans le solde réalisé.

### 7.7 Solde réalisé — pas de double comptage (transactions cochées + enveloppe cochée)

> Scénario de non-régression. Vérifie que cocher individuellement toutes les transactions
> PUIS cocher l'enveloppe ne crée pas de double comptage dans le solde réalisé.

**Pré-requis** : Une enveloppe de dépense à 500 CHF avec 3 transactions allouées (ex: 100, 150, 200 = total 450). Aucun élément coché. Noter le solde réalisé initial.

**Workflow** :

1. **Cocher la transaction 1** (100 CHF)
   - Critère : le solde réalisé augmente de 100 (enveloppe non cochée → seules les transactions cochées comptent)
2. **Cocher la transaction 2** (150 CHF)
   - Critère : le solde réalisé = +250 par rapport à l'initial
3. **Cocher la transaction 3** (200 CHF)
   - Critère : le solde réalisé = +450 par rapport à l'initial
4. **Cocher l'enveloppe** (pas de dialog car toutes les transactions sont déjà cochées)
   - Critère : le solde réalisé passe à **+500** par rapport à l'initial (montant de l'enveloppe)
   - Critère : le solde réalisé ne doit PAS être à +950 (double comptage : 450 + 500)
   - Explication : `max(500, 450) = 500`

### 7.8 Solde réalisé — enveloppe non cochée, seules les transactions comptent

**Pré-requis** : Une enveloppe de dépense à 500 CHF avec des transactions allouées.

**Workflow** :

1. **Cocher uniquement les transactions** (sans cocher l'enveloppe)
   - Critère : le solde réalisé compte uniquement la somme des transactions cochées
   - Critère : le montant de l'enveloppe (500) n'est PAS compté
   - Explication : enveloppe non cochée → `consumed_checked` seulement, pas `max(enveloppe, consumed)`

### 7.9 Suppression d'une enveloppe avec transactions allouées — impact complet

> Quand une enveloppe est supprimée, ses transactions allouées deviennent des transactions libres
> (`budget_line_id` passe à NULL via `ON DELETE SET NULL`). Le solde est recalculé.
> Les transactions libres impactent directement le Reste (pas de couverture par enveloppe).

**Pré-requis** : Deux budgets consécutifs (mois M et M+1). Sur le mois M : une enveloppe de dépense à 2000 CHF avec 2 transactions allouées (500 + 300 = 800 CHF). L'enveloppe est cochée, les transactions aussi.

**Workflow** :

1. **Noter les valeurs avant** :
   - Reste du mois M
   - Solde réalisé du mois M
   - Solde final (endingBalance) du mois M
   - Report du mois M+1

2. **Supprimer l'enveloppe** (2000 CHF) > Confirmer

3. **Vérifier le Reste** :
   - Avant : l'enveloppe couvrait les transactions → total dépenses incluait `max(2000, 800) = 2000`
   - Après : l'enveloppe n'existe plus, les transactions sont libres → total dépenses inclut seulement `800`
   - Critère : le Reste augmente de **1200** (2000 - 800)

4. **Vérifier le solde réalisé** :
   - Avant : enveloppe cochée → `max(2000, 800) = 2000` comptés
   - Après : les transactions sont libres et cochées → seuls `800` comptés
   - Critère : le solde réalisé diminue de **1200** en dépenses (donc augmente de 1200)

5. **Vérifier le solde final** :
   - Critère : le solde final (endingBalance) augmente de **1200**

6. **Vérifier le rollover M+1** :
   - Naviguer vers le mois M+1
   - Critère : le report augmente de **1200** (reflète le nouveau solde final de M)
   - Critère : le Disponible de M+1 augmente de **1200**

**Variante — enveloppe avec dépassement** :

Si l'enveloppe était à 500 CHF avec 800 CHF de transactions :
- Avant : `max(500, 800) = 800`
- Après : transactions libres = 800
- Critère : le Reste ne change PAS (800 = 800, même impact)

**Variante — enveloppe sans transactions** :

Si l'enveloppe à 2000 CHF n'avait aucune transaction :
- Avant : `max(2000, 0) = 2000`
- Après : 0 (rien ne reste)
- Critère : le Reste augmente de **2000**

### 7.10 Dépassement d'enveloppe — vérification de la barre de progression

**Pré-requis** : Une enveloppe de dépense à 200 CHF.

**Workflow** : Ajouter une transaction allouée de 250 CHF > Valider

**Critères** :
- La transaction est acceptée (pas de blocage)
- La barre de progression de l'enveloppe dépasse 100%
- Le "Dépensé" affiche 250 / 200
- Le Reste global diminue de 50 seulement (la partie excédentaire : 250 - 200)
- Supprimer la transaction ramène tout à la normale

### 7.11 Alertes de dépassement

**Critères** :
- 80% du budget consommé : alerte orange (warning)
- 90% du budget consommé : alerte rouge (strong)
- 100%+ : autorisé, crée un report négatif (dette) vers le mois suivant

---

## 8. Réglages

### 8.1 Configurer le jour de paie

**Workflow** : Réglages > Sélectionner un jour de paie (1-31) > Sauvegarder

**Critères** :
- Le message d'aide affiche la période résultante (ex: "du 25 au 24 du mois suivant")
- Le mois courant est recalculé selon cette configuration
- La période apparaît dans les détails des budgets

### 8.2 Annuler les modifications de réglages

**Workflow** : Réglages > Modifier le jour de paie > Cliquer "Annuler"

**Critères** :
- La valeur revient à l'état initial
- Le bouton de sauvegarde disparaît

### 8.3 Changer son mot de passe

**Workflow** : Réglages > Section sécurité > Changer le mot de passe > Saisir mot de passe actuel + nouveau mot de passe + confirmation > Valider

**Critères** :
- Le mot de passe est mis à jour
- Un message de succès est affiché
- Erreur si le mot de passe actuel est incorrect

### 8.4 Régénérer sa clé de secours

**Workflow** : Réglages > Section sécurité > Régénérer la clé de secours > Saisir son mot de passe pour vérification > Valider > Nouvelle clé affichée

**Critères** :
- La nouvelle clé est affichée et doit être sauvegardée
- L'ancienne clé de secours ne fonctionne plus

### 8.5 Supprimer son compte

**Workflow** : Réglages > Zone de danger > Supprimer le compte > Saisir son mot de passe > Confirmer

**Critères** :
- Le compte est programmé pour suppression (délai de grâce de 3 jours)
- L'utilisateur est déconnecté automatiquement
- Les routes protégées ne sont plus accessibles

---

## 9. Informations & Légal

### 9.1 Consulter la boîte de dialogue "À propos"

**Workflow** : Menu utilisateur > Cliquer "À propos"

**Critères** :
- La version de l'application est affichée
- Le hash du commit est affiché
- Les liens vers les CGU, politique de confidentialité et changelog sont présents

### 9.2 Accéder au changelog

**Workflow** : Boîte de dialogue "À propos" > Cliquer "Nouveautés"

**Critères** :
- Le changelog s'ouvre dans un nouvel onglet

### 9.3 Consulter les CGU

**Workflow** : Boîte de dialogue "À propos" > Cliquer "Conditions Générales d'Utilisation"

**Critères** :
- La page des CGU s'affiche

### 9.4 Consulter la politique de confidentialité

**Workflow** : Boîte de dialogue "À propos" > Cliquer "Politique de Confidentialité"

**Critères** :
- La page de la politique de confidentialité s'affiche

---

## 10. Résilience & UX

### 10.1 Persistance de session après rafraîchissement

**Workflow** : Être connecté > Rafraîchir la page (F5)

**Critères** :
- L'utilisateur reste connecté
- Les données sont rechargées sans perte de contexte

### 10.2 Navigation responsive (mobile / desktop)

**Critères** :
- Sur mobile : menu burger, bottom sheets pour les actions, menus contextuels
- Sur desktop : navigation latérale, dialogues modaux, boutons d'action séparés
- Le passage d'un viewport à l'autre adapte l'interface

### 10.3 Page de maintenance

**Workflow** : L'application est en mode maintenance

**Critères** :
- Un message de maintenance est affiché
- Les fonctionnalités de l'app ne sont pas accessibles

### 10.4 Navigation rapide entre mois

**Workflow** : Détails d'un budget > Cliquer rapidement 3-4 fois sur "Mois précédent"

**Critères** :
- L'app ne plante pas
- Le dernier mois demandé s'affiche correctement (pas de mélange de données)

---

## 11. Cas limites

### 11.1 Enveloppe à 0 CHF

**Workflow** : Ajouter une enveloppe de dépense avec montant = 0 > Valider

**Critères** :
- L'enveloppe est créée
- Le reste global ne change pas
- Ajouter une transaction de 20 CHF à cette enveloppe fonctionne
- Le dépassement est de 20 CHF (tout est excédentaire)
- Supprimer l'enveloppe pour nettoyer

### 11.2 Budget sans revenu

**Critères** :
- Un budget doit avoir au moins une ligne de revenu (règle métier RG-004)
- Si toutes les lignes de revenu sont supprimées, un avertissement est affiché

### 11.3 Dépenses dépassant les revenus dans un modèle

**Workflow** : Créer/modifier un modèle où dépenses + épargne > revenus

**Critères** :
- Un avertissement est affiché (pas bloquant)
- Le modèle peut quand même être sauvegardé

---

## Annexe : Couverture E2E existante

> Référence rapide pour identifier les scénarios déjà couverts par les tests Playwright.

| Scénario | Couvert | Fichier(s) E2E |
|----------|---------|----------------|
| 1.1 Créer un compte email | Partiellement | `vault-code.spec.ts` |
| 1.3 Se connecter email | Oui | `authentication.spec.ts`, `session.spec.ts` |
| 1.4 Se connecter Google | Oui | `google-oauth.spec.ts` |
| 1.5 Se souvenir appareil | Oui | `vault-code.spec.ts` |
| 1.6 Mot de passe oublié | Oui | `password-recovery.spec.ts` |
| 1.7 Code PIN oublié | Oui | `vault-code.spec.ts` |
| 1.8 Se déconnecter | Oui | `core-navigation.spec.ts`, `session.spec.ts` |
| 1.9 Multi-onglets | Oui | `multi-tab-session.spec.ts` |
| 1.10 Protection routes | Oui | `authentication.spec.ts`, `navigation.spec.ts` |
| 2.1 Onboarding | Oui | `complete-profile.spec.ts` |
| 3.1 Mode démo | Oui | `demo-mode.spec.ts` |
| 4.1–4.3 Modèles | Partiellement | `budget-template-management.spec.ts`, `template-details-view.spec.ts` |
| 4.4 Modifier modèle | Oui | `template-propagation.spec.ts` |
| 4.5 Supprimer modèle | Oui | `budget-template-deletion.spec.ts` |
| 5.2 Créer budget | Partiellement | `template-selection-behavior.spec.ts` |
| 5.3 Détails budget | Oui | `monthly-budget-management.spec.ts` |
| 5.5 Modifier prévision | Oui | `budget-line-editing.spec.ts`, `budget-line-edit-mobile.spec.ts` |
| 5.6 Supprimer prévision | Oui | `budget-line-deletion.spec.ts` |
| 6.1 Dashboard mois courant | Oui | `monthly-budget-management.spec.ts` |
| 7.4 Calcul enveloppes | Oui | `envelope-allocation.spec.ts` |
| 8.1 Jour de paie | Oui | `payday-settings.spec.ts` |
| 8.3 Changer mot de passe | Oui | `settings-change-password.spec.ts` |
| 8.4 Régénérer clé | Oui | `settings-recovery-key.spec.ts` |
| **Non couvert** | | |
| 1.2 Créer compte Google | Non | — |
| 5.4 Ajouter prévision | Non | — |
| 5.7 Cycle de vie transaction allouée | Non | — |
| 5.8 Dialog cascade comptabilisation | Non | — |
| 5.9 Cocher enveloppe sans transactions | Non | — |
| 5.10 Cocher transaction n'affecte pas parent | Non | — |
| 5.11 Badge et dépensé enveloppe | Non | — |
| 5.12 Export JSON | Non | — |
| 5.13 Export Excel | Non | — |
| 5.14 Recherche transactions | Non | — |
| 6.2 Transaction rapide FAB | Non | — |
| 6.3–6.4 Modifier/Supprimer transaction | Non | — |
| 7.1–7.3 Calculs, solde final & rollover | Non | — |
| 7.5 Solde réalisé — sans dépassement | Non | — |
| 7.6 Solde réalisé — avec dépassement | Non | — |
| 7.7 Solde réalisé — pas de double comptage | Non | — |
| 7.8 Solde réalisé — enveloppe non cochée | Non | — |
| 7.9 Suppression enveloppe avec transactions | Non | — |
| 7.10 Dépassement d'enveloppe | Non | — |
| 7.11 Alertes dépassement | Non | — |
| 8.2 Annuler réglages | Non | — |
| 8.5 Supprimer compte | Non | — |
| 9.1–9.4 À propos & légal | Non | — |
| 10.4 Navigation rapide | Non | — |
| 11.1–11.3 Cas limites | Non | — |
