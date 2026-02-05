# Cahier de test manuel — Epic #274 (Chiffrement AES-256-GCM)

> **Objectif :** Valider le bon fonctionnement du chiffrement après déploiement en prod.
> **Prérequis :** Accès à la prod (webapp + DB via Supabase Dashboard ou CLI).

---

## Légende

- ⏳ À tester
- ✅ OK
- ❌ KO (noter le problème)

---

## 1. Mode démo (pas de friction)

> Le mode démo ne doit PAS demander de code coffre-fort (#308).

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1.1 | Ouvrir l'app déconnecté, cliquer "Essayer en mode démo" | ✅ | |
| 1.2 | Vérifier : accès direct au dashboard (pas d'écran "code coffre-fort") | ✅ | |
| 1.3 | Naviguer dans l'app : les montants s'affichent correctement | ✅ | |
| 1.4 | Aller dans Paramètres : vérifier que la section "Sécurité" est masquée | ✅ | |
| 1.5 | Se déconnecter du mode démo | ✅ | |
| 1.6 | Vérifier en DB : aucune entrée dans `user_encryption_key` pour le user démo | ✅ | |

```sql
-- Vérifier qu'aucune clé n'existe pour le user démo
SELECT * FROM user_encryption_key WHERE user_id = (SELECT id FROM auth.users WHERE email LIKE '%demo%');
-- Attendu : 0 rows
```

---

## 2. Inscription email/password (nouveau user)

> Tester avec un email jetable (ex: `test-encrypt-{timestamp}@yopmail.com`).

| # | Test | Status | Notes |
|---|------|--------|-------|
| 2.1 | Créer un compte avec email/password | ✅ | |
| 2.2 | Vérifier : écran "Crée ton code coffre-fort" s'affiche | ✅ | |
| 2.3 | Vérifier : bouton toggle visibilité fonctionne sur le champ code | ✅ | |
| 2.4 | Saisir un code < 8 caractères → vérifier message d'erreur | ✅ | |
| 2.5 | Saisir un code coffre-fort (8+ caractères) + confirmation différente → erreur | ✅ | |
| 2.6 | Saisir un code coffre-fort (8+ caractères) + confirmation identique | ✅ | |
| 2.7 | Vérifier : texte du bouton devient "On prépare ton coffre..." pendant chargement | ✅ | |
| 2.8 | Vérifier : modal recovery key s'affiche automatiquement (non fermable) | ✅ | |
| 2.9 | Vérifier : format base32 groupé `XXXX-XXXX-XXXX-...` (52 chars) | ✅ | |
| 2.10 | Cliquer le bouton "Copier" → vérifier copie dans le presse-papier | ✅ | |
| 2.11 | Vérifier : texte du bouton devient "Copié !" après copie | ✅ | |
| 2.12 | Tenter de fermer la modal (clic extérieur / Escape) → impossible | ✅ | |
| 2.13 | Coller la recovery key en minuscules dans le champ de confirmation | ✅ | |
| 2.14 | Vérifier : validation passe (case-insensitive) | ✅ | |
| 2.15 | Vérifier : bouton "Confirmer" devient actif après confirmation | ✅ | |
| 2.16 | Confirmer → fermer la modal | ✅ | Noter recovery key : `________________` |
| 2.17 | Vérifier : redirection vers le dashboard | ✅ | |
| 2.18 | Créer une prévision avec un montant (ex: 150€) | ✅ | |
| 2.19 | Vérifier en DB : `amount = 0` et `amount_encrypted` contient du base64 | ✅ | |

**Query de vérification DB :**
```sql
SELECT bl.id, bl.amount, bl.amount_encrypted
FROM budget_line bl
JOIN monthly_budget mb ON bl.budget_id = mb.id
WHERE mb.user_id = '{USER_ID}'
LIMIT 5;
```

---

## 3. Login email/password (user existant)

> Tester avec le compte créé en section 2.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 3.1 | Se déconnecter | ✅ | |
| 3.2 | Se reconnecter avec email/password | ✅ | |
| 3.3 | Vérifier : écran "Entre ton code coffre-fort" s'affiche | ✅ | |
| 3.4 | Vérifier : bouton toggle visibilité fonctionne | ✅ | |
| 3.5 | Saisir le bon code coffre-fort | ✅ | |
| 3.6 | Vérifier : texte du bouton devient "Vérification..." pendant chargement | ✅ | |
| 3.7 | Vérifier : accès au dashboard, montants visibles et corrects | ✅ | |
| 3.8 | Vérifier : la prévision créée affiche 150€ | ✅ | |

---

## 4. Option "Ne plus me demander sur cet appareil"

> Tester le comportement de persistance du code coffre-fort.
> **Note :** La déconnexion explicite efface TOUJOURS le localStorage (sécurité).
> L'option "Ne plus me demander" sert à garder la clé si on ferme le navigateur SANS se déconnecter.

### 4.1 Checkbox cochée (localStorage) — fermeture navigateur sans logout

| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.1.1 | Se connecter, cocher "Ne plus me demander sur cet appareil" | ✅ | |
| 4.1.2 | Saisir le code coffre-fort et valider | ✅ | |
| 4.1.3 | Vérifier en DevTools : `localStorage` contient `pulpe-vault-client-key-local` | ✅ | |
| 4.1.4 | Fermer le navigateur complètement (SANS se déconnecter) | ✅ | |
| 4.1.5 | Rouvrir le navigateur, aller sur l'app | ✅ | |
| 4.1.6 | Vérifier : accès direct au dashboard (pas d'écran code coffre-fort) | ✅ | |

### 4.2 Checkbox cochée — déconnexion explicite efface la clé

| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.2.1 | Se connecter avec "Ne plus me demander" coché | ✅ | |
| 4.2.2 | Vérifier : `localStorage` contient `pulpe-vault-client-key-local` | ✅ | |
| 4.2.3 | Se déconnecter explicitement | ✅ | |
| 4.2.4 | Vérifier : `localStorage` ne contient PLUS `pulpe-vault-client-key-local` | ✅ | |
| 4.2.5 | Se reconnecter → code coffre-fort redemandé (comportement normal) | ✅ | |

### 4.3 Checkbox décochée (sessionStorage) — fermeture onglet

| # | Test | Status | Notes |
|---|------|--------|-------|
| 4.3.1 | Vider localStorage et sessionStorage dans DevTools | ✅ | |
| 4.3.2 | Se connecter, NE PAS cocher "Ne plus me demander" | ✅ | |
| 4.3.3 | Saisir le code coffre-fort et valider | ✅ | |
| 4.3.4 | Vérifier en DevTools : `sessionStorage` contient `pulpe-vault-client-key-session` | ✅ | |
| 4.3.5 | Vérifier : `localStorage` ne contient PAS `pulpe-vault-client-key-local` | ✅ | |
| 4.3.6 | Fermer l'onglet (pas le navigateur), rouvrir l'app | ✅ | |
| 4.3.7 | Vérifier : code coffre-fort redemandé | ✅ | |

---

## 5. Code coffre-fort invalide (#305)

> Vérifier que l'app refuse un code incorrect (Key Check Canary pattern).

| # | Test | Status | Notes |
|---|------|--------|-------|
| 5.1 | Se déconnecter | ✅ | |
| 5.2 | Se reconnecter, à l'écran code coffre-fort saisir un code FAUX | ✅ | |
| 5.3 | Vérifier : message d'erreur "Ce code ne semble pas correct — vérifie et réessaie" | ✅ | |
| 5.4 | Vérifier : PAS d'accès au dashboard | ✅ | |
| 5.5 | Saisir le bon code → accès OK | ✅ | |
| 5.6 | Tester rate limiting : saisir 10+ codes faux rapidement | ✅ | |
| 5.7 | Vérifier : message de rate limiting après 10 tentatives (429) | ✅ | |

---

## 6. Lien "Code perdu ?" (récupération depuis écran login)

> Tester le flow de récupération via le lien sur l'écran de saisie du code.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 6.1 | Se déconnecter, se reconnecter jusqu'à l'écran "Entre ton code coffre-fort" | ✅ | |
| 6.2 | Cliquer sur le lien "Code perdu ?" | ✅ | |
| 6.3 | Vérifier : redirection vers l'écran de récupération | ✅ | |
| 6.4 | Vérifier : champ recovery key avec auto-formatage (XXXX-XXXX-...) | ✅ | |
| 6.5 | Saisir recovery key en minuscules → vérifier conversion en majuscules | ✅ | |
| 6.6 | Saisir recovery key sans tirets → vérifier formatage automatique | ✅ | |
| 6.7 | Saisir nouveau code coffre-fort + confirmation | ✅ | |
| 6.8 | Valider → vérifier texte bouton "Récupération..." | ✅ | |
| 6.9 | Vérifier : nouvelle recovery key affichée | ✅ | |
| 6.10 | Confirmer la nouvelle recovery key | ✅ | |
| 6.11 | Vérifier : accès au dashboard, données intactes | ✅ | |

---

## 7. Inscription Google OAuth

> Tester avec un compte Google (ou créer un compte test).

| # | Test | Status | Notes |
|---|------|--------|-------|
| 7.1 | Cliquer "Se connecter avec Google" (première fois) | ⏳ | |
| 7.2 | Autoriser l'app côté Google | ⏳ | |
| 7.3 | Vérifier : écran "Crée ton code coffre-fort" s'affiche | ⏳ | |
| 7.4 | Saisir un code coffre-fort + confirmation | ⏳ | |
| 7.5 | Vérifier : modal recovery key s'affiche | ⏳ | |
| 7.6 | Sauvegarder la recovery key | ⏳ | Noter ici : `________________` |
| 7.7 | Vérifier : accès au dashboard | ⏳ | |

---

## 8. Login Google OAuth (nouveau device / storage vidé)

> Simuler un nouveau device en vidant le localStorage.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 8.1 | Ouvrir DevTools > Application > Local Storage > Clear | ⏳ | |
| 8.2 | Rafraîchir la page | ⏳ | |
| 8.3 | Vérifier : écran "Entre ton code coffre-fort" s'affiche | ⏳ | |
| 8.4 | Saisir le code coffre-fort créé en 7.4 | ⏳ | |
| 8.5 | Vérifier : accès au dashboard, données intactes | ⏳ | |

---

## 9. Changement de mot de passe

> Tester avec le compte email/password de la section 2.

### 9.1 Changement réussi

| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.1.1 | Aller dans Paramètres > Sécurité | ✅ | |
| 9.1.2 | Cliquer "Changer le mot de passe" | ✅ | |
| 9.1.3 | Vérifier : dialog avec 3 champs (ancien, nouveau, confirmation) | ✅ | |
| 9.1.4 | Vérifier : toggle visibilité fonctionne sur chaque champ | ✅ | |
| 9.1.5 | Saisir ancien mot de passe + nouveau mot de passe | ✅ | |
| 9.1.6 | Confirmer le changement | ✅ | |
| 9.1.7 | Vérifier : modal recovery key s'ouvre automatiquement (nudge) | ✅ | |
| 9.1.8 | Sauvegarder la NOUVELLE recovery key | ✅ | Noter ici : `________________` |
| 9.1.9 | Vérifier : les montants sont toujours visibles et corrects | ✅ | |
| 9.1.10 | Se déconnecter, se reconnecter avec le NOUVEAU mot de passe | ✅ | |
| 9.1.11 | Saisir le code coffre-fort | ✅ | |
| 9.1.12 | Vérifier : accès OK, données intactes | ❌ | |

### 9.2 Ancien mot de passe incorrect

| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.2.1 | Aller dans Paramètres > Sécurité > Changer le mot de passe | ⏳ | |
| 9.2.2 | Saisir un MAUVAIS ancien mot de passe | ⏳ | |
| 9.2.3 | Vérifier : message d'erreur "Mot de passe incorrect..." | ⏳ | |
| 9.2.4 | Vérifier : possibilité de réessayer | ⏳ | |

### 9.3 Validation des champs

| # | Test | Status | Notes |
|---|------|--------|-------|
| 9.3.1 | Saisir nouveau mot de passe < 8 caractères → erreur | ⏳ | |
| 9.3.2 | Saisir confirmation différente du nouveau mdp → erreur | ⏳ | |
| 9.3.3 | Vérifier : bouton Valider désactivé tant que le form est invalide | ⏳ | |

---

## 10. Mot de passe oublié + récupération avec recovery key

> Tester avec un compte qui a une recovery key configurée.

### 10.1 Envoi du lien de réinitialisation

| # | Test | Status | Notes |
|---|------|--------|-------|
| 10.1.1 | Sur la page de login, cliquer "Mot de passe oublié ?" | ⏳ | |
| 10.1.2 | Saisir un email invalide → vérifier erreur de format | ⏳ | |
| 10.1.3 | Saisir l'email du compte | ⏳ | |
| 10.1.4 | Vérifier : texte bouton "Envoi en cours..." | ⏳ | |
| 10.1.5 | Vérifier : message de succès (même si email n'existe pas - anti-enumération) | ⏳ | |
| 10.1.6 | Vérifier : email de réinitialisation reçu | ⏳ | |

### 10.2 Réinitialisation avec recovery key

| # | Test | Status | Notes |
|---|------|--------|-------|
| 10.2.1 | Cliquer le lien dans l'email | ⏳ | |
| 10.2.2 | Vérifier : page `/reset-password` avec champs recovery key + nouveau mdp | ⏳ | |
| 10.2.3 | Saisir la recovery key + nouveau mot de passe | ⏳ | |
| 10.2.4 | Vérifier : texte bouton "Réinitialisation..." | ⏳ | |
| 10.2.5 | Valider | ⏳ | |
| 10.2.6 | Vérifier : modal nouvelle recovery key s'affiche | ⏳ | |
| 10.2.7 | Sauvegarder la nouvelle recovery key | ⏳ | Noter ici : `________________` |
| 10.2.8 | Vérifier : redirection dashboard, données intactes | ⏳ | |

### 10.3 Lien de réinitialisation expiré/invalide

| # | Test | Status | Notes |
|---|------|--------|-------|
| 10.3.1 | Utiliser un ancien lien de réinitialisation (déjà utilisé ou expiré) | ⏳ | |
| 10.3.2 | Vérifier : message d'erreur "Lien invalide ou expiré" | ⏳ | |
| 10.3.3 | Vérifier : possibilité de redemander un nouveau lien | ⏳ | |

---

## 11. Recovery key invalide

> Vérifier que l'app refuse une recovery key incorrecte.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 11.1 | Refaire le flow "mot de passe oublié" (10.1.1 à 10.2.2) | ⏳ | |
| 11.2 | Saisir une recovery key avec format invalide → erreur de pattern | ⏳ | |
| 11.3 | Saisir une recovery key FAUSSE (bon format mais mauvaise clé) | ⏳ | |
| 11.4 | Vérifier : message d'erreur "Clé de récupération invalide — vérifie que tu as bien copié la clé" | ⏳ | |
| 11.5 | Vérifier : pas de redirection, possibilité de réessayer | ⏳ | |

---

## 12. Régénérer la recovery key (Settings)

> Tester depuis Paramètres > Sécurité.

### 12.1 Régénération réussie

| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.1.1 | Aller dans Paramètres > Sécurité | ⏳ | |
| 12.1.2 | Cliquer "Régénérer ma clé de récupération" | ⏳ | |
| 12.1.3 | Vérifier : dialog demande mot de passe + ancienne recovery key | ⏳ | |
| 12.1.4 | Vérifier : toggle visibilité sur le champ mot de passe | ⏳ | |
| 12.1.5 | Saisir le mot de passe et l'ancienne recovery key | ⏳ | |
| 12.1.6 | Valider | ⏳ | |
| 12.1.7 | Vérifier : nouvelle recovery key affichée | ⏳ | |
| 12.1.8 | Confirmer avoir sauvegardé la nouvelle clé | ⏳ | |
| 12.1.9 | Vérifier : l'ancienne recovery key ne fonctionne plus (test via flow 10.x) | ⏳ | |

### 12.2 Mot de passe incorrect

| # | Test | Status | Notes |
|---|------|--------|-------|
| 12.2.1 | Cliquer "Régénérer ma clé de récupération" | ⏳ | |
| 12.2.2 | Saisir un MAUVAIS mot de passe | ⏳ | |
| 12.2.3 | Vérifier : message "Mot de passe incorrect ou clé de chiffrement invalide" | ⏳ | |
| 12.2.4 | Vérifier : possibilité de réessayer | ⏳ | |

---

## 13. Migration des users existants (backfill)

> Tester avec les 3 users prod existants (si non encore migrés).

| # | Test | Status | Notes |
|---|------|--------|-------|
| 13.1 | Identifier un user non migré en DB (`amount_encrypted IS NULL`) | ⏳ | |
| 13.2 | Se connecter avec ce compte | ⏳ | |
| 13.3 | Vérifier : écran "Crée ton code coffre-fort" (première fois post-migration) | ⏳ | |
| 13.4 | Créer le code coffre-fort | ⏳ | |
| 13.5 | Vérifier : backfill automatique (données chiffrées au premier login) | ⏳ | |
| 13.6 | Vérifier en DB : `amount = 0`, `amount_encrypted` contient du base64 | ⏳ | |

---

## 14. Vérification globale en DB

> Exécuter après que tous les users se sont connectés au moins une fois.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 14.1 | Exécuter la query ci-dessous | ⏳ | |
| 14.2 | Vérifier : tous les counts = 0 | ⏳ | |

```sql
SELECT 'budget_line' as t, count(*) FROM budget_line WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'transaction', count(*) FROM transaction WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'template_line', count(*) FROM template_line WHERE amount_encrypted IS NULL
UNION ALL
SELECT 'savings_goal', count(*) FROM savings_goal WHERE target_amount_encrypted IS NULL
UNION ALL
SELECT 'monthly_budget', count(*) FROM monthly_budget WHERE ending_balance_encrypted IS NULL;
-- Attendu : 0 partout
```

---

## 15. Test de non-régression : calculs métier

> Vérifier que les calculs (rollover, disponible, etc.) fonctionnent avec les données chiffrées.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 15.1 | Créer un budget mensuel avec plusieurs prévisions | ⏳ | |
| 15.2 | Ajouter des transactions | ⏳ | |
| 15.3 | Vérifier : "Disponible à dépenser" calculé correctement | ⏳ | |
| 15.4 | Passer au mois suivant | ⏳ | |
| 15.5 | Vérifier : rollover (report) calculé correctement | ⏳ | |
| 15.6 | Vérifier : templates s'appliquent avec les bons montants | ⏳ | |

---

## 16. Bouton "Se déconnecter" depuis l'écran coffre-fort

> Vérifier qu'on peut se déconnecter sans saisir le code.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 16.1 | Se reconnecter jusqu'à l'écran "Entre ton code coffre-fort" | ⏳ | |
| 16.2 | Cliquer sur "Se déconnecter" | ⏳ | |
| 16.3 | Vérifier : loader "Déconnexion..." s'affiche (pas de confirmation) | ⏳ | |
| 16.4 | Vérifier : retour à l'écran de login | ⏳ | |

---

## 17. Multi-onglets / comportement session

> Tester le comportement avec plusieurs onglets.

| # | Test | Status | Notes |
|---|------|--------|-------|
| 17.1 | Ouvrir l'app dans un premier onglet, se connecter complètement | ⏳ | |
| 17.2 | Ouvrir l'app dans un second onglet | ⏳ | |
| 17.3 | Vérifier : le second onglet a accès au dashboard (clé partagée) | ⏳ | |
| 17.4 | Se déconnecter dans le premier onglet | ⏳ | |
| 17.5 | Rafraîchir le second onglet | ⏳ | |
| 17.6 | Vérifier : retour à l'écran de login | ⏳ | |

---

## Résumé

| Section | Nombre de tests | OK | KO |
|---------|-----------------|----|----|
| 1. Mode démo | 6 | | |
| 2. Inscription email/password | 19 | | |
| 3. Login email/password | 8 | | |
| 4. Option "Ne plus me demander" | 18 | | |
| 5. Code coffre-fort invalide | 7 | | |
| 6. Lien "Code perdu ?" | 11 | | |
| 7. Inscription Google OAuth | 7 | | |
| 8. Login Google nouveau device | 5 | | |
| 9. Changement de mot de passe | 19 | | |
| 10. Mot de passe oublié | 14 | | |
| 11. Recovery key invalide | 5 | | |
| 12. Régénérer recovery key | 13 | | |
| 13. Migration backfill | 6 | | |
| 14. Vérification DB | 2 | | |
| 15. Non-régression calculs | 6 | | |
| 16. Déconnexion depuis coffre-fort | 5 | | |
| 17. Multi-onglets | 6 | | |
| **TOTAL** | **157** | | |

---

## Notes de test

```
Date de test : 2026-02-04
Testeur : Maxime

Recovery keys sauvegardées (pour debug) :
- User test email : ____________________
- User test Google : ____________________
```

---

## Bugs identifiés

### BUG #1 : Erreur 500 au lieu de 400 lors de la récupération avec mauvaise recovery key

**Reproduction :**
1. Se connecter avec un compte qui a un code coffre-fort configuré
2. Aller sur l'écran "Code perdu ?" (`/recover-vault-code`)
3. Saisir une recovery key INVALIDE + un nouveau code coffre-fort
4. Soumettre le formulaire

**Comportement actuel :**
- Réponse HTTP 500 Internal Server Error
- Message : `"Unsupported state or unable to authenticate data"`
- Stack trace exposé dans la réponse (fuite d'info)

**Comportement attendu :**
- Réponse HTTP 400 Bad Request
- Message user-friendly : `"Clé de récupération invalide"`

**Cause technique :**
- Fichier : `backend-nest/src/modules/encryption/encryption.service.ts`
- Fonction : `recoverWithKey()` (ligne ~375)
- Appelle `unwrapDEK()` (ligne ~301) qui fait un déchiffrement AES-GCM
- Quand la recovery key est invalide, le déchiffrement échoue avec une erreur Node.js crypto
- Cette erreur n'est pas catchée → remonte comme 500

**Fix suggéré :**
```typescript
// Dans recoverWithKey(), wrapper l'appel à unwrapDEK() :
try {
  const dek = unwrapDEK(wrappedDek, kekFromRecoveryKey);
} catch (error) {
  throw new BadRequestException('Clé de récupération invalide');
}
```

**Curl pour reproduire :**
```bash
curl -X POST 'http://localhost:3000/api/v1/encryption/recover' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'Content-Type: application/json' \
  -d '{"recoveryKey":"FAKE-RECO-VERY-KEY1-2345-6789-ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ12","newClientKey":"80bde3286a848b56a5269df86df131347341ab19e032348220715903e5b8e304"}'
```

---

### BUG #2 (CRITIQUE) : Le recover génère un nouveau salt → le nouveau code coffre-fort ne fonctionne jamais

**Reproduction :**
1. Avoir un compte avec code coffre-fort configuré
2. Aller sur "Code perdu ?" (`/recover-vault-code`)
3. Saisir la bonne recovery key + un nouveau code coffre-fort
4. Le recover réussit (200 OK), nouvelle recovery key affichée
5. Se déconnecter
6. Se reconnecter et saisir le nouveau code coffre-fort
7. **Échec** : "Ce code ne semble pas correct"

**Comportement actuel :**
- Le recover retourne 200 OK
- Une nouvelle recovery key est générée
- Mais le nouveau code coffre-fort ne fonctionne JAMAIS
- L'utilisateur est bloqué (perte d'accès aux données)

**Comportement attendu :**
- Après recover, le nouveau code coffre-fort doit fonctionner

**Cause technique :**
- Fichier : `backend-nest/src/modules/encryption/encryption.service.ts`
- Fonction : `recoverWithKey()` (lignes 377-382)

```typescript
// Le backend génère un NOUVEAU salt
const newSalt = randomBytes(SALT_LENGTH);
const newDek = this.#deriveDEK(newClientKey, newSalt, userId);
await this.#repository.updateSalt(userId, newSalt.toString('hex'));
```

**Le problème :**
1. Frontend dérive `newClientKey` avec l'**ancien salt** (récupéré au début du flow)
2. Backend génère un **nouveau salt** et dérive une DEK différente
3. Backend stocke le nouveau salt et calcule `key_check` avec cette DEK
4. Quand l'utilisateur se reconnecte :
   - Frontend récupère le **nouveau salt**
   - Frontend dérive la clé avec `PBKDF2(nouveauCode, nouveauSalt)`
   - Cette clé est **DIFFÉRENTE** de celle utilisée pour le `key_check`

**Preuve dans les logs :**
```
Avant recover : salt = "5f43305dba674d584063ad68f8f9691d"
Après recover : salt = "8adfad0c3a4726f99d08d56ddc356964"
```

**Fix suggéré :**
Option 1 : Ne pas générer de nouveau salt lors du recover - réutiliser l'ancien
Option 2 : Changer le flow pour que le frontend envoie le code brut, et le backend dérive avec le nouveau salt

---

### BUG #3 : ZodError "amount too small" lors du toggle-check d'une transaction

**Reproduction :**
1. Se connecter avec un compte chiffré (code coffre-fort actif)
2. Avoir une transaction (dépense) dans le budget
3. Cocher la transaction pour la marquer comme "vérifiée"
4. **Erreur** : ZodError dans la console frontend

**Comportement actuel :**
- Erreur Zod : `"Too small: expected number to be >0"` sur `data.amount`
- La transaction n'est pas cochée (ou l'UI plante)

**Comportement attendu :**
- La transaction se coche normalement
- Le montant affiché reste correct

**Cause technique :**
- Le backend retourne `amount: 0` (valeur masquée car chiffrée)
- Le frontend a un schéma Zod qui valide `amount > 0`
- Cette validation échoue car `amount = 0`

**Réponse API :**
```json
{
  "success": true,
  "data": {
    "id": "68c73361-c59b-4ce4-9e6a-0843505a08d5",
    "amount": 0,  // ← Valeur masquée (chiffrement actif)
    "name": "Dépense",
    "kind": "expense",
    ...
  }
}
```

**Fix suggéré :**
Modifier le schéma Zod frontend pour accepter `amount >= 0` quand le chiffrement est actif,
OU le backend devrait retourner le montant déchiffré dans la réponse.

**Curl pour reproduire :**
```bash
curl -X POST 'http://localhost:3000/api/v1/transactions/{TRANSACTION_ID}/toggle-check' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-Client-Key: {CLIENT_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

### BUG #4 (CRITIQUE) : Le changement de mot de passe génère un nouveau salt → le code coffre-fort ne fonctionne plus après logout

**Reproduction :**
1. Se connecter avec un compte chiffré (code coffre-fort actif)
2. Aller dans Paramètres > Sécurité > Changer le mot de passe
3. Saisir ancien mot de passe + nouveau mot de passe
4. Le changement réussit, nouvelle recovery key affichée
5. Les données restent visibles (session active)
6. Se déconnecter
7. Se reconnecter avec le nouveau mot de passe
8. Saisir le code coffre-fort (inchangé)
9. **Échec** : "Ce code ne semble pas correct" (400 ERR_ENCRYPTION_KEY_CHECK_FAILED)

**Comportement actuel :**
- Le changement de mot de passe réussit (200 OK)
- Une nouvelle recovery key est générée
- Les données restent accessibles tant que la session est active
- Après logout, le code coffre-fort ne fonctionne plus
- L'utilisateur perd l'accès à ses données

**Comportement attendu :**
- Après changement de mot de passe, le code coffre-fort doit continuer à fonctionner

**Cause technique :**
- Fichier : `backend-nest/src/modules/encryption/encryption.service.ts`
- Fonction : `#executePasswordChange()` (lignes 415-420)
- Même problème que BUG #2 (recover)

```typescript
const newSalt = randomBytes(SALT_LENGTH);  // ← NOUVEAU salt généré
const newDek = this.#deriveDEK(newClientKey, newSalt, userId);
await this.#repository.updateSalt(userId, newSalt.toString('hex'));
```

**Le problème :**
1. Frontend dérive `newClientKey` avec l'**ancien salt**
2. Backend génère un **nouveau salt** et dérive une DEK différente
3. Backend stocke le nouveau salt et calcule `key_check` avec cette DEK
4. Après logout, le frontend récupère le **nouveau salt**
5. La clé dérivée avec `PBKDF2(code, nouveauSalt)` ne correspond pas au `key_check`

**Réponse API lors de la reconnexion :**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Client key verification failed",
  "code": "ERR_ENCRYPTION_KEY_CHECK_FAILED"
}
```

**Fix suggéré :**
Même fix que BUG #2 : ne pas générer de nouveau salt, ou changer le flow pour que
le backend dérive la clé avec le nouveau salt et retourne le salt au frontend.

**Note :** Ce bug et le BUG #2 ont la même cause racine. Un fix doit corriger les deux.
