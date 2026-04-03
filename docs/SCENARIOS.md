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

**Workflow** : Écran de saisie du code PIN > pointer "Se souvenir de cet appareil" > Saisir le code > Valider > Se déconnecter > Se reconnecter > Le code PIN n'est pas redemandé

**Critères** :
- La clé est stockée en `localStorage` (persiste entre sessions)
- Sans la case pointée, la clé est en `sessionStorage` (perdue à la fermeture)

### 1.6 Mot de passe oublié

**Pré-requis** : Utilisateur avec une identité email (compte email ou email + OAuth).

**Workflow** : Page de login > Cliquer "Mot de passe oublié" > Saisir son email > Recevoir le lien de réinitialisation > Cliquer le lien > Saisir un nouveau mot de passe > Saisir sa clé de secours > Valider > Recevoir une nouvelle clé de secours > Se connecter avec le nouveau mot de passe

**Critères** :
- Si l'utilisateur est OAuth-only (aucune identité email) : la page de réinitialisation affiche un message "Réinitialisation non disponible" avec un bouton retour vers le login
- La page "Mot de passe oublié" ne révèle pas si le compte est OAuth ou email (bonne pratique sécurité)

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
- Si "Se souvenir" était pointé, la clé localStorage est conservée

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

**Workflow** : Page des modèles > Cliquer "Créer un modèle" > Saisir un nom > Ajouter des lignes de revenus > Ajouter des lignes de dépenses (récurrentes) > Ajouter des lignes d'épargne > Optionnellement pointer "Modèle par défaut" > Valider

**Critères** :
- Le modèle apparaît dans la liste
- Le nom doit être unique
- Le bouton de création est désactivé si le maximum (5) est atteint

### 4.3 Consulter les détails d'un modèle

**Workflow** : Page des modèles > Cliquer sur un modèle

**Critères** :
- Le solde net est affiché (revenus - dépenses - épargne)
- Les totaux par catégorie sont affichés (pilules : revenus, dépenses, épargne)
- Toutes les lignes de prévisions sont listées dans un tableau

### 4.4 Modifier les lignes d'un modèle

**Workflow** : Détails du modèle > Ouvrir l'édition des prévisions > Ajouter/modifier/supprimer des lignes > Choisir le mode de mise à jour : "Modèle uniquement" OU "Appliquer aux mois suivants" > Valider

**Critères** :
- Si "Modèle uniquement" : seul le modèle est modifié, les budgets existants ne changent pas
- Si "Appliquer aux suivants" : le modèle ET les budgets futurs non ajustés manuellement sont mis à jour
- Les lignes marquées `is_manually_adjusted` dans les budgets ne sont jamais modifiées par la mise à jour
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
- Pour chaque ligne : nom, montant, consommation (dépensé/restant), statut pointé/non pointé
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
- La ligne est marquée comme `is_manually_adjusted` (ne sera plus affectée par la mise à jour du modèle)
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

4. **pointer une transaction** : pointer "Migros"
   - Critère : la transaction apparaît pointée visuellement
   - Critère : le compteur de transactions pointées s'incrémente

5. **Modifier une transaction** : Éditer "Coop", changer le montant de 45 à 60 > Valider
   - Critère : "Dépensé" de l'enveloppe = 90 (30 + 60)
   - Critère : le reste global reflète le changement (-15 supplémentaires)

6. **Retirer le pointage** : Retirer le pointage de "Migros"
   - Critère : retour à l'état non pointé, compteur décrémenté

7. **Supprimer une transaction** : Supprimer "Coop" > Confirmer
   - Critère : "Dépensé" de l'enveloppe = 30 (seule "Migros" reste)
   - Critère : le reste global remonte de 60

8. **Supprimer la dernière transaction** : Supprimer "Migros" > Confirmer
   - Critère : "Dépensé" de l'enveloppe = 0
   - Critère : le reste global revient à la valeur initiale

### 5.8 Pointer une enveloppe — Dialog de cascade

**Pré-requis** : Une enveloppe avec au moins une transaction allouée NON pointée.

**Workflow** :

1. **pointer l'enveloppe parent** (la ligne de prévision, pas la transaction) > Un dialog apparaît : "Pointer les transactions ?"
2. **Choisir "Oui, tout pointer"** > L'enveloppe ET toutes ses transactions passent à pointées
   - Critère : toutes les transactions de l'enveloppe sont pointées
   - Critère : l'enveloppe elle-même est pointée

3. **Retirer le pointage de l'enveloppe** > Pas de dialog
   - Critère : seule l'enveloppe repasse à non pointée, les transactions restent pointées

4. **Re-pointer l'enveloppe** > Le dialog réapparaît (car il n'y a pas de transactions non pointées cette fois) OU ne réapparaît pas si toutes sont déjà pointées
   - Critère : si toutes les transactions sont déjà pointées, pas de dialog, l'enveloppe se coche directement

5. **Retirer manuellement le pointage des transactions** > Puis pointer à nouveau l'enveloppe > Le dialog réapparaît

**Variante : refuser la cascade** :

1. **pointer l'enveloppe parent** > Dialog apparaît
2. **Choisir "Non, juste l'enveloppe"** > Seule l'enveloppe est pointée
   - Critère : les transactions allouées restent non pointées
   - Critère : l'enveloppe est pointée

### 5.9 pointer / retirer le pointage d'une enveloppe sans transactions

**Workflow** : Détails du budget > pointer une enveloppe qui n'a aucune transaction allouée

**Critères** :
- Pas de dialog de cascade (rien à cascader)
- L'enveloppe passe à pointée directement
- Retirer le pointage fonctionne sans dialog également

### 5.10 pointer une transaction n'affecte pas le parent

**Workflow** : Ouvrir une enveloppe avec plusieurs transactions > pointer toutes les transactions une par une

**Critères** :
- Même quand toutes les transactions sont pointées, l'enveloppe parent ne se coche PAS automatiquement
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

### 5.14 Filtrer dans les détails d'un budget (recherche locale)

**Workflow** : Détails d'un budget > Saisir un terme dans la barre de recherche (ex: "courses")

**Critères** :
- Le filtrage est instantané (pas de chargement)
- Les lignes de prévisions dont le nom ou le montant correspond sont affichées
- Les transactions allouées sont visibles si leur enveloppe parent OU la transaction elle-même correspond
- Les transactions libres sont filtrées par leur propre nom et montant
- La recherche est insensible aux accents ("epargne" trouve "Épargne") et à la casse
- Vider le champ restaure l'affichage complet
- Le filtre de recherche se combine avec le filtre "À pointer" / "Toutes"

### 5.15 Rechercher des transactions à travers tous les budgets (recherche globale)

**Workflow** : Page des budgets (calendrier) > Cliquer sur l'icône de recherche > Saisir un terme (minimum 2 caractères) dans le dialog > Voir les résultats

**Critères** :
- Un message invite à saisir au moins 2 caractères avant de lancer la recherche
- Les résultats affichent la période (année/mois), le nom et le montant de chaque transaction trouvée, tous budgets confondus
- Les montants sont colorés par type (revenu, dépense, épargne)
- Un filtre par année permet de restreindre la recherche
- Cliquer sur un résultat ferme le dialog et navigue vers le budget concerné
- Si aucun résultat : un message "Pas de résultat" est affiché
- Si erreur réseau : un message d'erreur est affiché

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

### 6.5 pointer / retirer le pointage d'une entrée financière

**Workflow** : Mois courant > Cliquer sur la case à pointer d'une entrée (prévision ou transaction)

**Critères** :
- Le statut visuel change
- Sur le dashboard, pas de dialog de cascade (comportement simplifié par rapport aux détails du budget)

---

## 7. Calculs & Règles métier

> **Deux métriques distinctes** à vérifier :
>
> | Métrique | Calcul | Items pris en compte |
> |----------|--------|---------------------|
> | **Reste / Solde final** | `Disponible - totalDépenses` | Toutes les lignes et transactions (pointées ou non) |
> | **Solde réalisé** | `RevenusPointés - DépensesPointées` | Uniquement les items pointés |
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
> Solde réalisé = pour chaque enveloppe pointée: max(montant_enveloppe, somme_transactions_pointées)
>               + pour chaque enveloppe non pointée: somme_transactions_pointées seulement
>               + transactions libres pointées
> ```

### 7.1 Vérification du calcul "Disponible à dépenser"

**Workflow** : Ouvrir les détails d'un budget > Noter les valeurs affichées

**Critères** :
- `Disponible` = somme de toutes les lignes de revenu + report du mois précédent
- `Reste` = Disponible - totalDépenses (avec logique enveloppe ; inclut dépenses ET épargne)
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

> Le Reste utilise `max(montant_enveloppe, total_toutes_transactions)` — indépendamment du statut pointé.

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

### 7.5 Solde réalisé — enveloppe pointée sans dépassement

> Règle : quand une enveloppe est pointée, le solde réalisé compte `max(montant_enveloppe, total_transactions_pointées)`.
> Le `consumed` ne prend en compte que les transactions **pointées**.

**Pré-requis** : Une enveloppe de dépense à 2000 CHF, sans transactions. Noter le solde réalisé initial.

**Workflow** :

1. **Ajouter une transaction** de 100 CHF dans l'enveloppe
2. **Ajouter une deuxième transaction** de 900 CHF dans l'enveloppe
   - Critère : "Dépensé" de l'enveloppe = 1000 / 2000
3. **pointer l'enveloppe** via le dialog "Pointer les transactions ?" > **Choisir "Oui, tout pointer"**
   - Critère : le solde réalisé compte **2000** (pas 1000, ni 2000 + 1000)
   - Explication : `max(2000, 1000) = 2000`, l'enveloppe couvre

**Variante** : pointer l'enveloppe **sans cascader** (choisir "Non, juste l'enveloppe")
   - Critère : le solde réalisé compte **2000** aussi (`max(2000, 0) = 2000` car aucune transaction n'est pointée)

### 7.6 Solde réalisé — enveloppe pointée avec dépassement

> Règle : quand les transactions pointées dépassent l'enveloppe, c'est le total pointé qui est compté.

**Pré-requis** : Continuer depuis 7.5 (enveloppe 2000 CHF, transactions 100 + 900).

**Workflow** :

1. **Ajouter une troisième transaction** de 2000 CHF dans l'enveloppe
   - Critère : "Dépensé" de l'enveloppe = 3000 / 2000 (dépassement de 1000)
2. **pointer l'enveloppe** via le dialog > **"Oui, tout pointer"** (les 3 transactions + l'enveloppe sont pointées)
   - Critère : le solde réalisé compte **3000** (pas 2000)
   - Explication : `max(2000, 3000) = 3000`, le réel dépasse la prévision

**Attention** : Si on coche l'enveloppe **sans cascader les transactions** (elles restent non pointées), le solde réalisé compte **2000** (`max(2000, 0) = 2000`). Il faut que les transactions soient pointées pour que le dépassement apparaisse dans le solde réalisé.

### 7.7 Solde réalisé — pas de double comptage (transactions pointées + enveloppe pointée)

> Scénario de non-régression. Vérifie que pointer individuellement toutes les transactions
> PUIS pointer l'enveloppe ne crée pas de double comptage dans le solde réalisé.

**Pré-requis** : Une enveloppe de dépense à 500 CHF avec 3 transactions allouées (ex: 100, 150, 200 = total 450). Aucun élément pointé. Noter le solde réalisé initial.

**Workflow** :

1. **pointer la transaction 1** (100 CHF)
   - Critère : le solde réalisé augmente de 100 (enveloppe non pointée → seules les transactions pointées comptent)
2. **pointer la transaction 2** (150 CHF)
   - Critère : le solde réalisé = +250 par rapport à l'initial
3. **pointer la transaction 3** (200 CHF)
   - Critère : le solde réalisé = +450 par rapport à l'initial
4. **pointer l'enveloppe** (pas de dialog car toutes les transactions sont déjà pointées)
   - Critère : le solde réalisé passe à **+500** par rapport à l'initial (montant de l'enveloppe)
   - Critère : le solde réalisé ne doit PAS être à +950 (double comptage : 450 + 500)
   - Explication : `max(500, 450) = 500`

### 7.8 Solde réalisé — enveloppe non pointée, seules les transactions comptent

**Pré-requis** : Une enveloppe de dépense à 500 CHF avec des transactions allouées.

**Workflow** :

1. **pointer uniquement les transactions** (sans pointer l'enveloppe)
   - Critère : le solde réalisé compte uniquement la somme des transactions pointées
   - Critère : le montant de l'enveloppe (500) n'est PAS compté
   - Explication : enveloppe non pointée → `consumed_checked` seulement, pas `max(enveloppe, consumed)`

### 7.9 Suppression d'une enveloppe avec transactions allouées — impact complet

> Quand une enveloppe est supprimée, ses transactions allouées deviennent des transactions libres
> (`budget_line_id` passe à NULL via `ON DELETE SET NULL`). Le solde est recalculé.
> Les transactions libres impactent directement le Reste (pas de couverture par enveloppe).

**Pré-requis** : Deux budgets consécutifs (mois M et M+1). Sur le mois M : une enveloppe de dépense à 2000 CHF avec 2 transactions allouées (500 + 300 = 800 CHF). L'enveloppe est pointée, les transactions aussi.

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
   - Avant : enveloppe pointée → `max(2000, 800) = 2000` comptés
   - Après : les transactions sont libres et pointées → seuls `800` comptés
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

**Pré-requis** : Utilisateur avec une identité email (compte email ou email + OAuth).

**Workflow** : Réglages > Section sécurité > Changer le mot de passe > Saisir mot de passe actuel + nouveau mot de passe + confirmation > Valider

**Critères** :
- Le mot de passe est mis à jour
- Un message de succès est affiché
- Erreur si le mot de passe actuel est incorrect
- Si l'utilisateur est OAuth-only : le bouton "Modifier le mot de passe" n'est pas affiché dans la section sécurité

### 8.4 Régénérer sa clé de secours

**Workflow** : Réglages > Section sécurité > Régénérer la clé de secours > Saisir son mot de passe pour vérification > Valider > Nouvelle clé affichée

**Critères** :
- La nouvelle clé est affichée et doit être sauvegardée
- L'ancienne clé de secours ne fonctionne plus

### 8.5 Changer son code PIN

**Workflow** : Réglages > Section sécurité > Changer le code PIN > Saisir le code PIN actuel > Saisir le nouveau code PIN > Confirmer le nouveau code PIN > Valider > Recevoir une nouvelle clé de secours (si configurée) > Message de succès

**Critères** :
- L'ancien code PIN est vérifié avant le changement
- Toutes les données financières sont re-chiffrées avec la nouvelle clé dérivée du nouveau PIN
- Une nouvelle clé de secours est toujours générée et affichée après le changement de PIN (l'ancienne, si elle existait, ne fonctionne plus)
- Le nouveau code PIN fonctionne pour les connexions suivantes
- Erreur si l'ancien code PIN est incorrect
- Erreur si le nouveau code PIN est identique à l'ancien

### 8.6 Supprimer son compte

**Workflow (email / email + OAuth)** : Réglages > Zone de danger > Supprimer le compte > Saisir son mot de passe > Confirmer

**Workflow (OAuth-only)** : Réglages > Zone de danger > Supprimer le compte > Saisir son code PIN (vault code) > Confirmer

**Critères** :
- Le compte est programmé pour suppression (délai de grâce de 3 jours)
- L'utilisateur est déconnecté automatiquement
- Les routes protégées ne sont plus accessibles
- La méthode de vérification dépend du type de compte : mot de passe pour les utilisateurs email, code PIN pour les utilisateurs OAuth-only

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
| 8.5 Changer code PIN | Non | — |
| **Non couvert** | | |
| 1.2 Créer compte Google | Non | — |
| 5.4 Ajouter prévision | Non | — |
| 5.7 Cycle de vie transaction allouée | Non | — |
| 5.8 Dialog cascade pointage | Non | — |
| 5.9 pointer enveloppe sans transactions | Non | — |
| 5.10 pointer transaction n'affecte pas parent | Non | — |
| 5.11 Badge et dépensé enveloppe | Non | — |
| 5.12 Export JSON | Non | — |
| 5.13 Export Excel | Non | — |
| 5.14 Filtre local budget détails | Non | — |
| 5.15 Recherche globale transactions | Non | — |
| 6.2 Transaction rapide FAB | Non | — |
| 6.3–6.4 Modifier/Supprimer transaction | Non | — |
| 7.1–7.3 Calculs, solde final & rollover | Non | — |
| 7.5 Solde réalisé — sans dépassement | Non | — |
| 7.6 Solde réalisé — avec dépassement | Non | — |
| 7.7 Solde réalisé — pas de double comptage | Non | — |
| 7.8 Solde réalisé — enveloppe non pointée | Non | — |
| 7.9 Suppression enveloppe avec transactions | Non | — |
| 7.10 Dépassement d'enveloppe | Non | — |
| 7.11 Alertes dépassement | Non | — |
| 8.2 Annuler réglages | Non | — |
| 8.5 Supprimer compte | Non | — |
| 9.1–9.4 À propos & légal | Non | — |
| 10.4 Navigation rapide | Non | — |
| 11.1–11.3 Cas limites | Non | — |

---

## 12. iOS — Authentification & Sécurité

> Scénarios spécifiques à l'app iOS (SwiftUI). L'authentification iOS diffère du web : biométrie native, keychain, grace period, widget.
> Les scénarios sont ordonnés selon le parcours chronologique de l'utilisateur.

### 12.1 Inscription — onboarding complet

**Workflow** : Ouvrir l'app pour la première fois > Parcourir les 5 étapes d'onboarding > S'inscrire

**Détail technique** :
```
OnboardingFlow (5 étapes) :
  1. WelcomeStep       → Écran d'accueil
  2. PersonalInfoStep   → Prénom (optionnel)
  3. ExpensesStep       → Revenus + dépenses estimées
  4. BudgetPreviewStep  → Aperçu du budget généré
  5. RegistrationStep   → Email + mot de passe (8+ chars, 1+ chiffre)
```
Après inscription :
1. `AuthService.signup()` → Supabase crée le compte
2. Tokens sauvegardés dans le Keychain régulier
3. `completeOnboarding()` → sauvegarde `last_used_email` + `hasReturningUser = true`
4. `PostAuthResolver.resolve()` → `.needsPinSetup`

**Critères** :
- L'inscription crée immédiatement une session (pas d'email de confirmation)
- `last_used_email` est persisté dans le Keychain (survit à la désinstallation, sert d'indicateur "returning user")
- L'utilisateur est redirigé vers le setup du code PIN (12.2)

### 12.2 Configuration du code PIN et création du budget

**Workflow** : Après inscription (12.1) > PinSetupView > Saisir un code PIN (4 chiffres) > Sauvegarder la recovery key > Arriver sur le dashboard

**Détail technique** :
1. PinSetupView → l'utilisateur crée son PIN (4 chiffres)
2. Dérivation PBKDF2-SHA256 (600k iterations) → clé client 256 bits
3. Le PIN n'est **jamais stocké**, seule la clé dérivée est conservée
4. Validation de la clé avec le serveur (endpoint key_check)
5. Stockage de la clé client dans le Keychain régulier + cache mémoire
6. Génération de la recovery key (52 caractères) → l'utilisateur doit la sauvegarder
7. Si onboarding : création du template + budget du mois courant depuis les données d'onboarding
8. `transitionToAuthenticated()`

**Critères** :
- Le PIN n'est jamais stocké, seule la clé dérivée est conservée
- La recovery key doit être sauvegardée avant de continuer
- Le template "Mois standard" et le budget du mois courant sont créés
- Si la création du budget échoue, un toast d'erreur est affiché
- L'alerte Face ID est proposée après le setup réussi (12.3)

### 12.3 Activation de Face ID après le setup du PIN

**Workflow** : Après le setup PIN (12.2) > Une alerte "Activer Face ID ?" apparaît

**Détail technique** :
- `enterAuthenticated(context: .pinSetup)` → `BiometricAutomaticEnrollmentPolicy.shouldAttempt(...)` vérifie (par ordre) :
  1. `attemptedThisTransition == false` (politique par transition, pas globale)
  2. `inFlight == false` (pas d'enrollment concurrent en cours)
  3. `biometricCapable == true` (appareil compatible Face ID / Touch ID)
  4. `biometricEnabled == false` (pas déjà activé)
  5. `recoveryFlowState.isModalActive == false` (pas de modale recovery visible)
- "Activer" → `biometric.enable(source: .automatic, reason: "pin_setup")` :
  1. Prompt Face ID via `BiometricService.authenticate()`
  2. Sauvegarde des tokens biométriques (access + refresh) dans le Keychain biométrique
  3. Sauvegarde de la clé client biométrique dans le Keychain biométrique
  4. `biometricEnabled = true` → persisté dans le Keychain via `BiometricPreferenceStore`
- "Plus tard" → aucun changement, l'utilisateur devra saisir son PIN à chaque retour

**Critères** :
- L'alerte est présentée automatiquement si Face ID est disponible et pas encore activé
- "Activer" : Face ID est configuré, 3 éléments sauvés dans le Keychain biométrique (tokens + clé client)
- "Plus tard" : pas d'activation, PIN requis à chaque retour ; la proposition réapparaît à la prochaine session (politique par transition)
- Stockage biométrique protégé par `SecAccessControl(.biometryCurrentSet)` + `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`

### 12.4 Connexion email/mot de passe

**Workflow** : Écran de login > Saisir email + mot de passe > "Se connecter"

**Détail technique** :
- Si `biometricEnabled` + tokens biométriques existent : un bouton "Continuer avec Face ID" est affiché en premier, séparé par "ou"
- Champs email + mot de passe avec toggle oeil (afficher/masquer)
- "Mot de passe oublié ?" → `ForgotPasswordSheet`
- `AuthService.login(email, password)` → tokens sauvés dans le Keychain régulier
- Email sauvegardé dans le Keychain (`last_used_email`) pour pré-remplissage au prochain login
- `resolvePostAuth()` route selon l'état du vault

**Critères** :
- Si biométrie active et tokens existent : bouton "Continuer avec Face ID" visible en haut
- Les champs ne sont pas effacés en cas d'erreur de connexion
- Le bouton "Se connecter" est désactivé si email ou mot de passe vide
- Après login réussi : PIN setup si premier login, PIN entry sinon
- "Nouveau sur Pulpe ? Créer un compte" renvoie vers l'onboarding
- Erreur localisée en français en cas d'échec

### 12.5 Saisie du code PIN — connexion et erreurs

**Workflow** : Après connexion email/mot de passe (12.4) ou retour dans l'app > Écran de saisie du PIN

**Détail technique** :
1. L'utilisateur saisit 4 chiffres → bouton "Confirmer" activé automatiquement
2. `getSalt()` → `deriveClientKey(pin, salt, iterations)` → `validateKey(clientKeyHex)`
3. Si valide : `store(clientKeyHex)` → cache + Keychain régulier → `completePinEntry()` → `transitionToAuthenticated()`
4. Si invalide : erreur affichée, chiffres effacés, `isError = true` pendant 1 seconde
5. Aucune limite de tentatives côté client
6. Rate limiting côté serveur uniquement (`.rateLimited` → "Trop de tentatives, patiente un moment")

**Critères** :
- PIN correct : transition vers le dashboard
- PIN incorrect : message "Ce code ne semble pas correct", chiffres effacés
- Erreur réseau : "Erreur de connexion, réessaie"
- Rate limited (serveur) : "Trop de tentatives, patiente un moment"
- Erreur crypto : "Erreur de sécurité, contacte le support"
- Pas de compteur de tentatives restantes visible
- Pas de lockout progressif côté client
- Actions disponibles : "Code PIN oublié ?" (recovery), "Se déconnecter" (logout), bouton Face ID (si biométrie activée)

### 12.6 Proposition d'activation de Face ID après saisie du PIN

**Workflow** : Saisie du PIN réussie (12.5) > L'alerte "Activer Face ID ?" apparaît

**Détail technique** :
- `enterAuthenticated(context: .pinEntry)` déclenche `BiometricAutomaticEnrollmentPolicy.shouldAttempt(...)` (mêmes règles que 12.3)
- Politique par transition (in-memory) : la proposition réapparaît à chaque nouvelle session d'authentification
- Si une modale recovery key est visible au moment de la transition, l'enrollment est différé jusqu'à la fermeture de la modale

**Critères** :
- L'alerte n'apparaît que si la biométrie n'est pas encore activée et que l'appareil est compatible
- Si la biométrie est déjà activée, pas d'alerte
- Si l'utilisateur refuse, la proposition réapparaît à la prochaine connexion (pas de blocage global permanent)
- Si un flow recovery key est en cours au moment du PIN, l'alerte attend la fin du flow (voir `RecoveryFlowState.isModalActive`)
- Même flow `biometric.enable(source: .automatic)` qu'en 12.3

### 12.7 Connexion avec Face ID — lancement à froid

**Workflow** : Fermer l'app > Rouvrir l'app (biométrie activée) > Face ID se déclenche automatiquement > Arriver sur le mois courant

**Détail technique** :
1. `checkAuthState()` charge `biometricEnabled` depuis le Keychain
2. `clearSession()` efface la clé client du Keychain régulier + cache (empêche un bypass avec une clé périmée)
3. `attemptBiometricSessionValidation()` : prompt Face ID unique via `LAContext` pré-authentifié
4. Lecture du `biometric_refresh_token` et `biometric_client_key` avec le contexte pré-authentifié (pas de double prompt)
5. Rafraîchissement de la session Supabase avec le refresh token
6. Validation de la clé client biométrique avec le serveur
7. `resolvePostAuth()` route vers le bon état

**Critères** :
- Face ID est proposé automatiquement au lancement (un seul prompt, pas de double prompt)
- Si Face ID réussit, l'utilisateur arrive sur le dashboard sans saisir de code PIN
- Si Face ID échoue/annulé (`KeychainError.userCanceled`/`.authFailed`) : fallback vers l'écran de login sans effacer l'état biométrique (`biometricEnabled` reste `true`, credentials préservés pour retry via bouton Face ID)
- Si erreur réseau : message "Connexion impossible, réessaie", `biometricEnabled` reste `true` pour retry
- Si la clé client biométrique est périmée (validation serveur échoue) : `clearAll()` + `biometricEnabled = false`, l'utilisateur est renvoyé au PIN ou au login
- Si session biométrique expirée : efface tokens + clés, `credentialsAvailable = false` mais `biometricEnabled` reste `true` (la préférence survit), message "Ta session a expiré", écran de login. Au prochain login + PIN, la biométrie pourra être ré-enrollée automatiquement

### 12.8 Verrouillage après grace period en arrière-plan (RG-006)

**Workflow** : Être authentifié > Mettre l'app en arrière-plan > Attendre >= 30 secondes (`AppConfiguration.backgroundGracePeriod`) > Revenir dans l'app

**Détail technique** :
1. `handleEnterBackground()` enregistre `backgroundDate = Date()`
2. Au retour : `isBackgroundLockRequired` vérifie `elapsed >= 30s && authState == .authenticated`
3. `prepareForForeground()` active `isRestoringSession = true` (affiche le PrivacyShield, empêche le flash de contenu)
4. `handleEnterForeground()` :
   a. `lastLockReason = .backgroundTimeout` est stocké explicitement **avant** le defer qui efface `isRestoringSession`
   b. `clearCache()` efface la clé client en mémoire
   c. Si biométrique activée → tente `resolveBiometricKey()` (Face ID)
   d. Si Face ID réussit → reprise transparente
   e. Si Face ID échoue/annulé → `authState = .needsPinEntry`
5. `flowState` retourne `.locked(.backgroundTimeout)` grâce à `lastLockReason` (déterministe, ne dépend pas du flag transitoire `isRestoringSession`)
6. `AppRuntimeCoordinator.handleScenePhaseChange()` orchestre le cycle foreground/background et déclenche `forceRefresh()` sur les stores

**Critères** :
- L'écran de saisie du code PIN est affiché (pas le login)
- Si la biométrie est activée, Face ID se déclenche automatiquement **avant** d'afficher le PIN pad
- Si Face ID réussit, retour au dashboard instantanément (pas de flash du PIN pad)
- Si Face ID échoue/annulé, l'utilisateur peut saisir son PIN manuellement
- Le bouton Face ID est visible sur le numpad tant que < 4 chiffres saisis
- Le bouton Face ID est remplacé par "Confirmer" une fois >= 4 chiffres saisis
- La navigation est préservée (l'utilisateur revient où il était)

### 12.9 Retour avant la grace period — pas de verrouillage

**Workflow** : Être authentifié > Mettre l'app en arrière-plan > Revenir avant 30 secondes

**Critères** :
- L'utilisateur reste authentifié
- Pas de demande de code PIN ni de Face ID
- Les données sont rafraîchies (`forceRefresh()` sur CurrentMonth, BudgetList, Dashboard)

### 12.10 Écran de confidentialité (app switcher)

**Workflow** : Être authentifié > Ouvrir le sélecteur d'apps (app switcher)

**Critères** :
- Un écran opaque avec le logo Pulpe recouvre le contenu sensible
- Aucun montant financier n'est visible dans l'aperçu de l'app switcher
- L'écran disparaît quand l'app revient au premier plan
- Activé quand `scenePhase != .active` ET (`authenticated` OU `needsPinEntry`)

### 12.11 Déconnexion avec biométrie activée

**Workflow** : Être connecté avec Face ID activé > Se déconnecter

**Détail technique** :
1. `saveBiometricTokens()` rafraîchit les tokens biométriques avec la session courante (fallback : `saveBiometricTokensFromKeychain()`)
2. Si la sauvegarde réussit : `logoutKeepingBiometricSession()` recrée le `SupabaseClient` (arrête l'auto-refresh), efface le Keychain régulier, **ne fait PAS** `signOut(scope: .local)` → le refresh token biométrique reste valide côté serveur
3. Si les deux tentatives de sauvegarde échouent : `authService.logout()` complet (révoque le refresh token) + `biometricEnabled = false` → Face ID perdu, mais l'utilisateur est informé au prochain login
4. `clearSession()` : efface la clé client du cache + Keychain régulier (la clé biométrique est préservée si sauvegarde réussie)
5. Nettoyage UI : `currentUser = nil`, navigation reset, widget data cleared

**Critères** :
- Avant logout, les tokens biométriques sont rafraîchis avec la session courante
- Le client key en mémoire et dans le keychain standard est effacé
- Le client key biométrique est **préservé** pour le prochain login Face ID
- Le refresh token biométrique reste **valide côté serveur** (pas de `signOut`)
- Au prochain lancement, Face ID est proposé automatiquement (12.13)
- Les données du widget sont effacées

### 12.12 Déconnexion sans biométrie

**Workflow** : Être connecté sans biométrie > Se déconnecter

**Détail technique** :
1. `authService.logout()` : appelle `supabase.auth.signOut(scope: .local)` (révoque le refresh token côté serveur) + `keychain.clearTokens()`
2. `clientKeyManager.clearSession()` : efface cache + Keychain régulier

**Critères** :
- `signOut(scope: .local)` est appelé → le refresh token est révoqué côté serveur
- Tous les tokens et client keys sont effacés (y compris biométrique)
- L'écran de login classique est affiché (si `hasReturningUser == true`, basé sur `last_used_email`), sinon l'onboarding
- Les données du widget sont effacées

### 12.13 Reconnexion après déconnexion — biométrie activée

**Workflow** : S'être déconnecté (12.11) > Rouvrir l'app

**Critères** :
- `biometricEnabled == true` est chargé depuis le Keychain
- Les tokens biométriques existent (préservés lors du logout)
- `didExplicitLogout == true` empêche le prompt Face ID automatique au cold start (choix de design : après un logout explicite, l'utilisateur doit initier la reconnexion)
- L'écran de login affiche un bouton "Continuer avec Face ID" que l'utilisateur doit taper manuellement
- Si Face ID réussit : la session est rafraîchie → `resolvePostAuth()` → écran de saisie du PIN (la clé client session a été effacée au logout)
- Si Face ID annulé : la session régulière est invalide (tokens effacés) → PIN entry si vault configuré, sinon login
- L'écran PIN affiche le bouton Face ID (possibilité de réessayer sans saisir le PIN)

### 12.14 Reconnexion après déconnexion — biométrie désactivée

**Workflow** : S'être déconnecté (12.12) > Rouvrir l'app

**Critères** :
- `biometricEnabled == false` → `authState = .unauthenticated`
- Si `hasReturningUser == true` (basé sur `last_used_email`) → `LoginView` affichée
- Email pré-rempli avec le dernier email utilisé (sauvegardé dans le Keychain via `last_used_email`)
- Après login réussi : `resolvePostAuth()` → `.needsPinEntry` (clé client absente)
- PinEntryView affichée sans bouton Face ID

### 12.15 Kill de l'app et relance

**Workflow** : Être authentifié > Forcer la fermeture de l'app (swipe up dans l'app switcher) > Rouvrir l'app

**Détail technique** :
1. Le process est tué → cache mémoire perdu
2. Keychain régulier : tokens + clé client **présents** (pas effacés par le kill)
3. Keychain biométrique : tokens + clé client biométrique **présents**
4. `checkAuthState()` commence par `clearSession()` → efface la clé client du Keychain régulier + cache
5. Si biométrie activée → Face ID (flow 12.7)
6. Si biométrie désactivée → `validateSession()` vérifie les tokens réguliers :
   - Si session valide → `resolvePostAuth()` → écran PIN directement (pas de login)
   - Si session invalide → `hasReturningUser` basé sur `last_used_email` dans le Keychain → LoginView ou OnboardingFlow

**Critères** :
- Si biométrie activée : Face ID automatique → si réussit, dashboard direct
- Si biométrie désactivée + session valide : **écran PIN directement** (pas de login)
- Si biométrie désactivée + session invalide + email sauvegardé : écran de login
- Si biométrie désactivée + session invalide + pas d'email : écran d'onboarding
- Les données ne sont pas perdues (API est la source de vérité)
- La navigation est réinitialisée (l'utilisateur arrive sur l'onglet "Accueil")

### 12.16 Désinstallation et réinstallation

**Workflow** : Être authentifié > Désinstaller l'app > Réinstaller depuis l'App Store ou TestFlight > Ouvrir l'app

**Détail technique** — ce qui survit à la désinstallation :

| Élément Keychain | Survit | Raison |
|------------------|--------|--------|
| `biometric_enabled` (préférence) | **Oui** | Keychain régulier persiste après désinstall |
| `last_used_email` | **Oui** | Keychain régulier persiste (sert d'indicateur "returning user") |
| `access_token` / `refresh_token` | **Oui** | Keychain régulier persiste |
| `client_key` | **Oui** | Keychain régulier persiste |
| `biometric_access_token` / `biometric_refresh_token` | **Oui** | Keychain biométrique persiste |
| `biometric_client_key` | **Oui** | Keychain biométrique persiste |

Ce qui est **perdu** :
- `UserDefaults` (effacé par iOS à la désinstallation)
- Cache mémoire, fichiers app (Documents/, Caches/)

**Critères** :
- Si `biometricEnabled == true` dans le Keychain ET les tokens biométriques sont encore valides côté serveur → Face ID fonctionne, reconnexion transparente
- Si `biometricEnabled == true` mais les tokens biométriques sont expirés côté serveur → efface tout, `biometricEnabled = false`, écran de login avec message "Ta session a expiré"
- Si `biometricEnabled == false` + session valide → écran PIN directement
- Si `biometricEnabled == false` + session invalide + `last_used_email` présent → écran de login (pas l'onboarding)
- Si `biometricEnabled == false` + session invalide + pas d'email → écran d'onboarding
- `clearKeychainIfReinstalled()` détecte la réinstallation via `UserDefaults("hasLaunchedBefore")` et efface tout le Keychain (`clearAllData()`) + `biometricEnabled = false` + `hasReturningUser = false`

### 12.17 Désactivation de Face ID

**Workflow** : Réglages > Compte > Désactiver Face ID

**Détail technique** :
1. `authService.clearBiometricTokens()` → efface `biometric_access_token`, `biometric_refresh_token`, `biometric_client_key`
2. `clientKeyManager.disableBiometric()` → efface `biometric_client_key` du Keychain
3. `biometricEnabled = false` → persisté dans le Keychain via `BiometricPreferenceStore`

**Critères** :
- Les tokens biométriques et le client key biométrique sont effacés du keychain
- Au prochain lancement, le PIN est demandé (pas de Face ID)
- Au prochain background lock : seul le PIN sera demandé
- Le bouton Face ID disparaît du numpad PinEntryView
- L'alerte d'activation peut réapparaître après la prochaine saisie de PIN

### 12.18 Code PIN oublié — recovery (RG-007)

**Workflow** : Écran de saisie du PIN > "Code PIN oublié ?" > Saisir la recovery key > Créer un nouveau PIN > Confirmer

**Critères** :
- La recovery key est validée côté serveur
- Un nouveau PIN est configuré (nouveau clientKey dérivé, re-chiffrement des données)
- Une nouvelle recovery key est générée et affichée
- L'ancienne recovery key ne fonctionne plus
- L'alerte biométrique est proposée après la recovery
- Si la biométrie était activée, le client key biométrique est re-sauvegardé

### 12.19 Réinitialisation du mot de passe

**Workflow** : LoginView > "Mot de passe oublié ?" > Saisir email > Recevoir deep link par email > Cliquer le lien > `ResetPasswordFlowView` s'ouvre en sheet > Saisir le nouveau mot de passe > Valider

**Détail technique** :
1. `ForgotPasswordSheet` → `AuthService.requestPasswordReset(email:)` → Supabase envoie un email avec deep link `pulpe://reset-password?...`
2. Deep link capturé par `PulpeApp.handleDeepLink()` → `deepLinkDestination = .resetPassword(url:)`
3. `AuthService.beginPasswordRecovery(from: url)` crée une session de recovery Supabase
4. `AuthService.updatePassword(newPassword)` met à jour le mot de passe
5. `completePasswordResetFlow()` :
   a. `authService.logout()` → révoque les tokens
   b. `clearBiometricTokens()` → nettoie tout le Keychain biométrique
   c. `clientKeyManager.clearAll()` → efface toutes les clés (cache + régulier + biométrique)
   d. `biometricEnabled = false`

**Critères** :
- Si l'utilisateur est déjà authentifié et clique un deep link reset password : le deep link est ignoré silencieusement (pas de logout surprise)
- Tous les tokens, client keys et biométrie sont effacés
- La biométrie est désactivée (`biometricEnabled = false`)
- Les données du widget sont effacées
- L'utilisateur est redirigé vers l'écran de login avec un toast "Mot de passe réinitialisé"
- L'utilisateur doit se reconnecter et saisir son PIN (la biométrie est à reconfigurer)
- Le dernier email utilisé (`last_used_email`) est **préservé** dans le Keychain (intentionnel : permet le pré-remplissage au prochain login après reset)
- Si l'utilisateur annule le flow : même nettoyage, pas de toast de succès

### 12.20 Expiration de session en cours d'utilisation

**Workflow** : Être authentifié > La session expire (token invalide côté serveur)

**Détail technique** :
- **Rafraîchissement automatique** : le SDK Supabase rafraîchit les tokens à chaque accès à `supabase.auth.session`
- **Clé client périmée** : notification `.clientKeyCheckFailed` → `handleStaleClientKey()` → efface toutes les clés → `authState = .needsPinEntry`
- **401 non-récupérable en cours de session** : `APIClient.refreshTokenAndRetry()` échoue → `AuthService.shared.logout()` + notification `.sessionExpired` → `RootView.onReceive` → `appState.send(.sessionExpired)` → `resetSession(.sessionExpiry)` → `clearSession()`, `currentUser = nil`, `authState = .unauthenticated`, stores reset atomiquement via `SessionDataResetting`, `biometricError = "Ta session a expiré, reconnecte-toi"`
- **Refresh token invalide au cold start** : `PostAuthResolver` détecte un 401 sur vault-status → tente un refresh → si échec → `.unauthenticatedSessionExpired`

**Critères** :
- Si la clé client est périmée : l'utilisateur est renvoyé à l'écran PIN (pas le login)
- Si le refresh token expire en cours de session (401 non-récupérable) : notification `.sessionExpired` → l'UI passe à `.unauthenticated` avec message d'erreur
- Si le refresh token est expiré au cold start : `biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"` → écran de login
- Les tokens sont nettoyés automatiquement en cas d'expiration

### 12.21 Erreur réseau au lancement

**Workflow** : Ouvrir l'app sans connexion réseau

**Détail technique** :
1. `checkMaintenanceStatus()` est appelé en premier
2. Si `URLError` → `isNetworkUnavailable = true` → `NetworkUnavailableView`
3. Si erreur serveur → `isInMaintenance = true` → `MaintenanceView`
4. Si OK → poursuit avec `checkAuthState()`
5. `StartupCoordinator` enforce un timeout de 30 secondes. Si le startup ne termine pas à temps : `send(.startupTimedOut)` → transition reducer → `NetworkUnavailableView`
6. Le `currentRunId` (UUID) garantit que les side-effects (stockage clé, biométrie) d'un startup annulé/timeout sont bloqués — seul le dernier `start()` peut écrire

**Critères** :
- Un écran dédié "Réseau indisponible" est affiché (pas un écran de login)
- Un bouton "Réessayer" est disponible
- `retryNetworkCheck()` re-vérifie la maintenance puis l'auth
- Si le réseau revient et que la maintenance est OK : l'auth check reprend normalement
- Aucune donnée locale n'est accessible hors-ligne (API-first)
- Après timeout (30s), les closures du startup précédent sont invalidées par le `runId` (pas de side-effects fantômes)

### 12.22 Mode maintenance

**Workflow** : Ouvrir l'app pendant une maintenance serveur

**Critères** :
- `MaintenanceView` est affichée (pas l'écran de login)
- La notification `.maintenanceModeDetected` est écoutée à tout moment (même en session)
- Quand la maintenance se termine : `checkAuthState()` est relancé automatiquement via `onChange(of: isInMaintenance)`
- En cours de session : si le serveur de santé signale maintenance, l'app bascule immédiatement

### 12.23 Widget — données visibles même app verrouillée (RG-008)

**Workflow** : Être authentifié > Vérifier le widget sur l'écran d'accueil > Verrouiller l'app (background > grace period) > Vérifier le widget

**Critères** :
- Le widget affiche le montant "Disponible" du mois courant
- Le widget continue d'afficher les données même quand l'app est verrouillée
- Les données du widget sont mises à jour quand l'app passe en arrière-plan
- Au logout, les données du widget sont effacées et le widget se rafraîchit

### 12.24 Course condition : consent recovery key pendant expiration de session

**Workflow** : Avoir accepte le consent recovery key > La generation de cle est en cours (`setupRecoveryKey()`) > La session expire pendant la generation > La generation termine (succes ou erreur)

**Detail technique** :
1. `acceptRecoveryKeyRepairConsent()` lance `recoveryFlowCoordinator.acceptConsent()`
2. `acceptConsent()` cree un `currentOperationId` (UUID) et passe en `.generatingKey`
3. Si `reset()` est appele pendant l'await (session expiry → `resetSession()` → `coordinator.reset()`), le `currentOperationId` est mis a `nil`
4. Quand `setupRecoveryKey()` termine, `guard currentOperationId == operationId` echoue → retourne `.error` sans modifier l'etat
5. Cote AppState : le guard `authState == .authenticated || authState == .needsPinEntry` bloque aussi les late callbacks (Wave 3)

**Criteres** :
- La generation de cle en cours est invalidee quand la session expire
- Pas de corruption d'etat : `authState` reste `.unauthenticated` apres expiry, pas de retour a `.authenticated`
- Double protection : operation ID dans `RecoveryFlowCoordinator` + guard `authState` dans `AppState+Recovery.swift`
- Un second `acceptConsent()` invalide le premier (last-writer-wins)
- `declineConsent()` pendant la generation invalide aussi l'operation en cours

### 12.25 Reset session transactionnel

**Workflow** : Toute deconnexion (logout, session expiry, password reset, suppression de compte) > Les stores de donnees et l'etat AppState sont reinitialises atomiquement

**Detail technique** :
1. `resetSession(_:scope)` dans `AppState+SessionReset.swift` :
   a. `currentUser = nil`, `authState = .unauthenticated`
   b. `sessionDataResetter?.resetStores()` — reset atomique des 3 feature stores (`CurrentMonthStore`, `BudgetListStore`, `DashboardStore`) via le protocole `SessionDataResetting`
   c. Reset coordinators (`RecoveryFlowCoordinator.reset()`, `BiometricAutomaticEnrollmentPolicy.resetForNewTransition()`)
   d. Reset navigation (`budgetPath`, `templatePath`, `selectedTab`) selon le scope
   e. Widget data cleared selon le scope
2. `LiveSessionDataResetter` est injecte dans `AppState` dans `PulpeApp.init()` apres creation des stores

**Criteres** :
- Le reset des stores se fait dans `resetSession()`, pas dans la couche UI (pas de `.onChange` reactif)
- Pas de timing gap entre le reset de `authState` et le reset des stores
- Si `sessionDataResetter` est nil (tests), le reset AppState fonctionne quand meme
- Fonctionne pour tous les scopes : `userLogout`, `systemLogout`, `sessionExpiry`, `recoverySessionExpiry`, `passwordReset`

### 12.26 Suppression de compte (ex 12.24)

**Workflow** : Réglages > Supprimer le compte > Confirmer

**Détail technique** :
1. `AuthService.deleteAccount()` → endpoint `DELETE` → retourne `scheduledDeletionAt`
2. `clearLastUsedEmail()` → efface le dernier email sauvegardé dans le Keychain
3. `hasReturningUser = false`
4. `logout()` complet (efface tout, tokens + widget + navigation)

**Critères** :
- Si succès : `hasReturningUser` est remis à `false` + `last_used_email` effacé → l'onboarding sera affiché à la prochaine inscription
- Tous les tokens et données locales sont effacés
- L'utilisateur est redirigé vers l'écran d'onboarding (pas le login, car `hasReturningUser == false`)
- Si erreur : toast "La suppression du compte a échoué", pas de changement d'état
- Le backend retourne une `scheduledDeletionAt` (délai de grâce avant suppression définitive)

---

## 13. iOS — Écarts avec les bonnes pratiques UX/UI

> Comparaison entre les standards recommandés (Apple HIG, apps bancaires, conventions mobiles)
> et l'implémentation actuelle de Pulpe iOS.

### 13.1 Écarts critiques (sécurité / UX)

| # | Sujet | Bonne pratique standard | Implémentation Pulpe | Impact |
|---|-------|-------------------------|---------------------|--------|
| 1 | **PIN : limite de tentatives client** | 5-6 tentatives max avec lockout progressif (30s → 5min → 15min) et compteur visible | Aucune limite côté client. Rate limiting serveur uniquement, message "Trop de tentatives" sans détail | Sécurité : brute force en boucle non limité côté client (10 000 combinaisons pour un PIN 4 chiffres). Le rate limit serveur atténue le risque mais le client ne freine pas l'attaquant |
| 2 | **PIN : séquences interdites** | Bloquer les séquences évidentes (1234, 0000, 1111, 9876, date de naissance) côté client | Aucune restriction : n'importe quelle combinaison est acceptée | Sécurité : PINs prévisibles acceptés, réduit l'entropie effective |

### 13.2 Écarts mineurs (améliorations UX)

| # | Sujet | Bonne pratique standard | Implémentation Pulpe | Impact |
|---|-------|-------------------------|---------------------|--------|
| 3 | Sign in with Apple | Recommandé / obligatoire si d'autres SSO sont proposés (App Store Review) | Non implémenté (email/password uniquement) | Moins d'options de connexion, pas de SSO natif |
| 4 | PIN : tentatives restantes | Afficher un compteur "X tentatives restantes" après un échec | Erreur générique "Ce code ne semble pas correct" sans compteur | L'utilisateur ne sait pas combien de tentatives restent avant le rate limit |
| 5 | Grace period configurable | L'utilisateur choisit la durée (immédiat, 1min, 5min, 15min) dans les réglages | Fixe à 30 secondes (`AppConfiguration.backgroundGracePeriod`), non configurable | Pas de personnalisation selon les préférences de sécurité de l'utilisateur |
| 6 | ~~Pré-remplir email au login~~ | Mémoriser le dernier email utilisé (Keychain ou UserDefaults) | ✓ Dernier email sauvegardé dans le Keychain (`last_used_email`), pré-rempli dans `LoginViewModel.init()`, effacé à la suppression de compte | - |
| 7 | PIN longueur fixe | 6 chiffres recommandé pour les apps financières (1M combinaisons vs 10K) | 4 chiffres exactement (`AppConfiguration.pinLength = 4`) | Espace de recherche plus petit (10K combinaisons pour 4 chiffres) |

### 13.3 Points conformes aux bonnes pratiques

| Sujet | Implémentation | Détail |
|-------|---------------|--------|
| PIN : confirmation à la création | Saisie sur un écran + confirmation sur un second écran | Mode `.chooseAndSetupRecovery` : 2-step flow avec détection de mismatch |
| Réinstallation : nettoyage Keychain | Détection via `UserDefaults` flag, keychain nettoyé automatiquement | Sécurité renforcée : auto-login involontaire évité après réinstall |
| Logout : confirmation | Dialogue de confirmation "Tu devras te reconnecter avec ton email et mot de passe." | UX : prévient les déconnexions accidentelles |
| Face ID disable : confirmation | Dialogue "Tu devras utiliser ton code PIN pour te connecter." | UX : prévient les désactivations accidentelles |
| Validation mot de passe temps réel | Critères visibles en temps réel (8 chars min, 1+ chiffre) | RegistrationStep + ResetPasswordFlowView : live criteria avec checkmarks verts |
| Biométrie : ne pas reproposer après refus | Refus persiste via UserDefaults jusqu'à réinstall ou réactivation biométrique | Pas d'agacement après refus |
| Feedback haptique | `.sensoryFeedback(.error)` sur PIN invalide, `.sensoryFeedback(.success)` sur succès | PinEntryView + PinSetupView : feedback sensoriel natif iOS |
| Face ID opt-in explicite | Alerte avec choix "Activer" / "Plus tard" | Pas d'activation silencieuse |
| Face ID prompt unique | `LAContext` pré-authentifié réutilisé pour lire tokens + clé | Pas de double prompt |
| Fallback Face ID → PIN | Automatique sur cancel/échec Face ID | L'utilisateur n'est jamais bloqué |
| Privacy shield (app switcher) | `PrivacyShieldOverlay` opaque avec logo Pulpe | Aucun contenu sensible visible dans le multitâche |
| Keychain protection niveau | `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | Pas de sync iCloud, accessible uniquement appareil déverrouillé |
| Biometric SecAccessControl | `.biometryCurrentSet` | Invalidé si les biométries de l'appareil changent |
| Dérivation de clé | PBKDF2-SHA256, 600 000 itérations minimum | Conforme aux standards crypto modernes |
| Recovery key | 52 caractères, sauvegarde obligatoire | Mécanisme de récupération robuste |
| API source de vérité | Aucun stockage local de données métier | Pas de SQLite/CoreData local |
| Token refresh automatique | SDK Supabase + sauvegarde Keychain à chaque accès | Transparent pour l'utilisateur |
| Navigation préservée | `NavigationPath` maintenu après background/foreground | L'utilisateur revient où il était |
| Deep link password reset | `pulpe://reset-password` capturé par `PulpeApp` | Flow natif sans passer par Safari |
| Logout biométrique préserve les tokens | `logoutKeepingBiometricSession()` ne révoque pas le refresh token | Reconnexion Face ID rapide après logout |
| Logout biométrique résilient | Si sauvegarde tokens échoue → full logout au lieu de perte silencieuse de Face ID | L'utilisateur n'est pas surpris par un Face ID non fonctionnel |
| Séparation Keychain régulier / biométrique | Tokens et clés séparés avec niveaux d'accès distincts | Pas de mélange de credentials |
| Pré-remplir email au login | Dernier email sauvegardé dans Keychain (`last_used_email`) | Pré-rempli dans `LoginViewModel.init()`, effacé à la suppression de compte |
| 401 non-récupérable mid-session | Notification `.sessionExpired` → `handleSessionExpired()` | L'UI passe à `.unauthenticated` immédiatement |
| Deep link reset password sécurisé | Ignoré silencieusement si déjà authentifié | Pas de logout surprise via deep link |
| Cold start clé biométrique périmée | `biometricEnabled = false` après `clearAll()` | Cohérent avec les autres paths de clé stale |

### 13.4 Résumé des recommandations prioritaires

### Items implémentés ✓

1. **Détecter la réinstallation** — ✓ Flag `UserDefaults("hasLaunchedBefore")` au premier lancement, keychain nettoyé automatiquement.

2. **Ajouter la confirmation du PIN** — ✓ Deux écrans lors du setup (`.chooseAndSetupRecovery`) : saisie → confirmation avec détection de mismatch.

3. **Ajouter un logout confirmation** — ✓ Dialogue de confirmation : "Tu devras te reconnecter avec ton email et mot de passe."

4. **Face ID disable confirmation** — ✓ Dialogue : "Tu devras utiliser ton code PIN pour te connecter."

5. **Validation mot de passe temps réel** — ✓ Critères visibles en temps réel (8 chars, 1+ chiffre) avec checkmarks verts dans RegistrationStep et ResetPasswordFlowView.

6. **Feedback haptique** — ✓ `.sensoryFeedback(.error)` sur PIN invalide, `.sensoryFeedback(.success)` sur succès.

7. **Biométrie : ne pas reproposer après refus** — ✓ Refus persiste via UserDefaults jusqu'à réinstall ou réactivation.

8. **Pré-remplir email au login** — ✓ Dernier email sauvegardé dans Keychain (`last_used_email`), pré-rempli dans `LoginViewModel.init()`, effacé à la suppression de compte.

9. **401 mid-session notifie AppState** — ✓ `APIClient.refreshTokenAndRetry()` poste `.sessionExpired` → `handleSessionExpired()` reset l'UI.

10. **Deep link reset password sécurisé** — ✓ Ignoré si déjà authentifié, pas de logout surprise.

11. **Cold start clé biométrique périmée** — ✓ `biometricEnabled = false` après `clearAll()` dans `attemptBiometricSessionValidation()`.

12. **Logout biométrique résilient** — ✓ Si sauvegarde tokens échoue → full logout + `biometricEnabled = false` au lieu de perte silencieuse.

### Recommandations restantes

1. **Ajouter un lockout progressif côté client** — Compteur de tentatives en mémoire (reset à chaque succès ou kill app). Après 5 échecs : délai de 30s. Après 8 : 5min. Afficher le compteur.

2. **Interdire les PINs triviaux** — Blacklist côté client : `0000`, `1111`, `1234`, `4321`, `9876`, séquences répétées. Message : "Ce code est trop simple, choisis-en un autre."

3. **Ajouter le Sign in with Apple** — Recommandé / obligatoire si d'autres SSO proposés (App Store Review).

4. **Grace period configurable** — L'utilisateur choisit la durée (immédiat, 1min, 5min, 15min) dans les réglages.
