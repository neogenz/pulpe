# Scenarios d'authentification iOS - Pulpe

Ce document couvre l'ensemble des workflows d'inscription, connexion, PIN, Face ID,
deconnexion, et les comportements lors du kill/reinstall de l'app.

Chaque scenario est decrit en deux sections :
- **Bonnes pratiques UX/UI** : le standard attendu (Apple HIG, banking apps, conventions mobiles)
- **Implementation Pulpe iOS** : le comportement reel du code

---

## Table des matieres

1. [Inscription (nouveau compte)](#1-inscription-nouveau-compte)
2. [Configuration du code PIN](#2-configuration-du-code-pin)
3. [Activation de Face ID](#3-activation-de-face-id)
4. [Connexion avec code PIN (cold start)](#4-connexion-avec-code-pin-cold-start)
5. [Connexion avec Face ID (cold start)](#5-connexion-avec-face-id-cold-start)
6. [Connexion email/mot de passe](#6-connexion-emailmot-de-passe)
7. [Background et retour au premier plan](#7-background-et-retour-au-premier-plan)
8. [Deconnexion (logout)](#8-deconnexion-logout)
9. [Reconnexion apres deconnexion](#9-reconnexion-apres-deconnexion)
10. [Kill de l'app et relance](#10-kill-de-lapp-et-relance)
11. [Desinstallation et reinstallation](#11-desinstallation-et-reinstallation)
12. [Desactivation de Face ID](#12-desactivation-de-face-id)
13. [Code PIN oublie (recovery)](#13-code-pin-oublie-recovery)
14. [Reinitialisation du mot de passe](#14-reinitialisation-du-mot-de-passe)
15. [Suppression de compte](#15-suppression-de-compte)
16. [Expiration de session](#16-expiration-de-session)
17. [Erreur reseau au lancement](#17-erreur-reseau-au-lancement)
18. [Mode maintenance](#18-mode-maintenance)
19. [Cle client perimee en cours de session](#19-cle-client-perimee-en-cours-de-session)
20. [Tableau comparatif des ecarts](#20-tableau-comparatif-des-ecarts)

---

## 1. Inscription (nouveau compte)

### Bonnes pratiques UX/UI

- **Progressive disclosure** : minimiser les champs initiaux (email + mot de passe), puis profile, puis securite
- Proposer "Sign in with Apple" comme alternative (obligatoire si autres SSO proposes)
- Afficher un indicateur de progression sur les etapes d'onboarding
- Ne pas demander le biometrique pendant l'inscription (surcharge cognitive) ; le proposer apres la premiere connexion reussie
- Valider le mot de passe avec des criteres visibles en temps reel
- Envoyer un email de confirmation si requis par le backend

### Implementation Pulpe iOS

**Flow complet :**

```
OnboardingFlow (5 etapes)
  1. WelcomeStep       → Ecran d'accueil
  2. PersonalInfoStep   → Prenom (optionnel)
  3. ExpensesStep       → Revenus + depenses estimees
  4. BudgetPreviewStep  → Apercu du budget genere
  5. RegistrationStep   → Email + mot de passe (8+ cars, 1+ chiffre)
```

**Apres l'inscription :**

1. `AuthService.signup()` envoie la requete a Supabase
2. Tokens (access + refresh) sauvegardes dans le **Keychain regulier**
3. `PostAuthResolver.resolve()` interroge le statut du vault (coffre de chiffrement)
4. Resultat : `.needsPinSetup` → l'utilisateur est redirige vers `PinSetupView`

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Sign in with Apple | Recommande / obligatoire si SSO | Non implemente |
| Indicateur de progression | Recommande pour multi-step | Present (5 etapes) |
| Validation mot de passe temps reel | Criteres visibles pendant la saisie | Criteres visibles en temps reel avec checkmarks (8 chars, 1 digit) (conforme) |
| Email de confirmation | Optionnel selon securite requise | Pas d'email de confirmation (session immediata) |

---

## 2. Configuration du code PIN

### Bonnes pratiques UX/UI

- PIN 6 chiffres recommande pour les apps financieres
- Flow en 2 ecrans separes : saisie puis confirmation (evite les erreurs)
- Interdire les sequences evidentes (1234, 0000, 1111)
- Feedback haptique a chaque chiffre et sur erreur
- Afficher la longueur attendue (points/cercles)
- Proposer la biometrique **immediatement** apres la configuration du PIN

### Implementation Pulpe iOS

**Flow :**

```
PinSetupView
  1. Saisie du PIN (4-6 chiffres, min 4)
  2. Le PIN n'est JAMAIS stocke
  3. Derivation PBKDF2-SHA256 : PIN + salt serveur → cle client 256 bits (600k iterations)
  4. Validation de la cle avec le serveur (endpoint key_check)
  5. Stockage de la cle client dans le Keychain regulier + cache memoire
  6. Generation de la cle de recuperation → l'utilisateur doit la sauvegarder
  7. Si onboarding : creation du template + budget du mois courant
  8. completePinSetup() (requires authState == .needsPinSetup, silent no-op otherwise)
     → enterAuthenticated(.pinSetup) → transition vers .authenticated
  9. Enrollment policy evaluates → prompt biometrique si appareil compatible et eligible
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Longueur PIN | 6 chiffres recommande | 4-6 chiffres (min 4 accepte) |
| Confirmation PIN | 2 ecrans saisie + confirmation | 2 etapes dans PinSetupView : enterPin → confirmPin (conforme) |
| Sequences interdites | Bloquer 1234, 0000, etc. | Aucune restriction sur les sequences |
| Derivation | PBKDF2 acceptable | PBKDF2-SHA256, 600k iterations (conforme) |
| Prompt biometrique | Proposer apres PIN setup | Propose apres transition vers authenticated (conforme) |

---

## 3. Activation de Face ID

### Bonnes pratiques UX/UI

- Face ID doit etre **opt-in** explicite (pas active silencieusement)
- Presenter un prompt clair : "Activer Face ID pour un acces plus rapide ?"
- Proposer le choix entre Face ID et PIN a tout moment
- Permettre la desactivation dans les reglages de l'app
- Respecter `NSFaceIDUsageDescription` dans Info.plist
- Stocker les credentials biometriques avec `SecAccessControl(.biometryCurrentSet)`
- Si l'utilisateur refuse, ne pas reproposer a chaque lancement

### Implementation Pulpe iOS

**Declenchement :**

```
enterAuthenticated(context:)
  → transitionToAuthenticated()
  → enrollmentPolicy.resetForNewTransition()
  → enrollmentPolicy.shouldAttempt(...)
      .proceed → markInFlight() → biometric.enable(source: .automatic) → markComplete()
      .skip    → policy logs SKIP internally (no prompt)
```

**enableBiometric() :**

```
1. Verifier biometricCapability()
2. Prompt Face ID via BiometricService.authenticate()
3. Si accepte :
   a. Sauvegarder biometric access + refresh tokens dans Keychain biometrique
   b. Sauvegarder biometric client key dans Keychain biometrique
   c. biometricEnabled = true → persiste dans Keychain (prefixe biometric_enabled)
4. Si refuse : return false, pas de changement d'etat
```

**Stockage biometrique :**

- Protection : `SecAccessControlCreateWithFlags(.biometryCurrentSet)`
- Accessibilite : `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- 3 elements proteges par biometrie :
  - `biometric_access_token`
  - `biometric_refresh_token`
  - `biometric_client_key`

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Opt-in explicite | Alerte avec choix | Alerte avec "Activer" / "Plus tard" (conforme) |
| NSFaceIDUsageDescription | Requis | Present dans Info.plist |
| SecAccessControl biometryCurrentSet | Recommande | Utilise (conforme) |
| Desactivation dans reglages | Toggle dans les settings | Present dans AccountView |
| Persistence du refus | Ne pas reproposer a chaque lancement | Per-transition policy via `BiometricAutomaticEnrollmentPolicy` : retry autorise a chaque nouvelle transition d'authentification (conforme) |

---

## 4. Connexion avec code PIN (cold start)

### Bonnes pratiques UX/UI

- Afficher le PIN pad immediatement sans delai
- Montrer le prenom de l'utilisateur pour personaliser l'ecran
- Proposer Face ID comme alternative (bouton sur le numpad)
- Afficher le nombre de tentatives restantes
- Lockout progressif cote client : apres 5-6 echecs, delai avant nouvelle tentative
- "Code PIN oublie ?" toujours visible

### Implementation Pulpe iOS

**Condition d'affichage :**

`authState == .needsPinEntry` est declenche quand :
- Le vault est configure (PIN + recovery key existent)
- Mais aucune cle client n'est disponible en cache/keychain

**Flow :**

```
PinEntryView
  1. Affiche le numpad + "Bonjour, {prenom}"
  2. Bouton Face ID sur le numpad (si biometricEnabled)
  3. Saisie 4-6 chiffres → bouton "Confirmer" quand >= 4 chiffres
  4. getSalt() → deriveClientKey(pin, salt, iterations) → validateKey(clientKeyHex)
  5. Si valide :
     a. store(clientKeyHex, enableBiometric: false) → cache + Keychain regulier
     b. onSuccess → completePinEntry() (requires authState == .needsPinEntry, silent no-op otherwise)
        → enterAuthenticated(.pinEntry)
  6. Si invalide :
     - "Ce code ne semble pas correct" (erreur generique)
     - Efface les chiffres, affiche erreur 1 seconde
     - Rate limited → "Trop de tentatives, patiente un moment"
```

**Actions disponibles :**
- "Code PIN oublie ?" → PinRecoveryView
- "Se deconnecter" → logout complet
- Bouton Face ID → attemptBiometricUnlock()

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Tentatives restantes | Afficher le compteur | Pas de compteur visible (erreur generique) |
| Lockout client | 5-6 tentatives puis delai progressif | Aucune limite cote client (rate limit serveur uniquement) |
| Message d'erreur | Specifique avec tentatives restantes | Generique : "Ce code ne semble pas correct" |
| Feedback haptique | Sur erreur et succes | Feedback haptique sur saisie (light), erreur (error), succes (success) via NumpadView (conforme) |

---

## 5. Connexion avec Face ID (cold start)

### Bonnes pratiques UX/UI

- Declencher Face ID automatiquement au lancement si active
- Un seul prompt Face ID (pas de double prompt)
- Si Face ID echoue/annule → fallback automatique vers PIN
- Si Face ID indisponible (masque, obscurite) → PIN directement
- Ne pas afficher de flash d'ecran intermediaire pendant le prompt

### Implementation Pulpe iOS

**Flow au lancement (`checkAuthState()`) :**

```
1. ensureBiometricPreferenceLoaded() → charge biometricEnabled depuis le Keychain
2. clearSession() → efface la cle client du Keychain regulier + cache
   (empeche un contournement avec une cle perimee)
3. Si biometricEnabled == false :
   - Nettoyer les tokens biometriques orphelins
   - authState = .unauthenticated → ecran de login
4. Si biometricEnabled == true :
   - attemptBiometricSessionValidation()
```

**attemptBiometricSessionValidation() :**

```
1. Verifier que des tokens biometriques existent dans le Keychain
2. Prompt Face ID unique via LAContext.evaluatePolicy()
   (localizedReason: "Se connecter avec Face ID")
3. Avec le LAContext pre-authentifie, lire :
   a. biometric_refresh_token
   b. biometric_client_key (optionnel)
4. Rafraichir la session Supabase avec le refresh token
5. Sauvegarder les nouveaux tokens dans les deux Keychains
6. Valider la cle client biometrique avec le serveur
7. resolvePostAuth() → route vers le bon etat
```

**Gestion des erreurs :**

| Erreur | Comportement |
|--------|-------------|
| Face ID annule (userCancel) | Tente une session reguliere → si valide : `.needsPinEntry`, sinon : `.unauthenticated` |
| Face ID echoue (authFailed) | Meme comportement que userCancel |
| Erreur reseau (URLError) | "Connexion impossible, reessaie" + garde biometricEnabled |
| Session expiree (AuthServiceError) | Efface tout + biometricEnabled = false + "Ta session a expire" |
| Erreur inconnue | Efface tout + biometricEnabled = false + message d'expiration |

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Prompt unique | Un seul prompt Face ID | Pre-authenticated LAContext → un seul prompt (conforme) |
| Fallback vers PIN | Automatique | Sur annulation Face ID → .needsPinEntry (conforme) |
| Pas de flash ecran | Transition fluide | PrivacyShieldOverlay + isRestoringSession (conforme) |
| Declenchement auto | Au lancement si active | Automatique dans checkAuthState() (conforme) |

---

## 6. Connexion email/mot de passe

### Bonnes pratiques UX/UI

- Proposer Face ID / Touch ID en premier si disponible
- Email + mot de passe comme fallback
- "Mot de passe oublie ?" toujours visible
- Ne pas effacer les champs en cas d'erreur
- Masquer/afficher le mot de passe (toggle oeil)
- Disable le bouton si les champs sont vides

### Implementation Pulpe iOS

**Ecran : `LoginView`**

**Flow :**

```
1. Si biometricEnabled + tokens biometriques existent :
   - Bouton "Continuer avec Face ID" affiche en premier
   - Separateur "ou"
2. Champs email + mot de passe
3. Toggle oeil pour afficher/masquer le mot de passe
4. "Mot de passe oublie ?" → ForgotPasswordSheet
5. "Se connecter" → AuthService.login(email, password)
6. Si succes : resolvePostAuth() → PIN setup/entry/authenticated
7. Si erreur : message localise, champs conserves
8. "Nouveau sur Pulpe ? Creer un compte" → retour vers onboarding
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Face ID en premier | Si active, proposer en premier | Bouton "Continuer avec Face ID" en haut (conforme) |
| Toggle mot de passe | Oeil pour afficher/masquer | Present (conforme) |
| Conservation des champs | Ne pas effacer sur erreur | Champs conserves (conforme) |
| Disable si vide | Bouton inactif si champs vides | `canSubmit` basee sur email+password non vides (conforme) |

---

## 7. Background et retour au premier plan

### Bonnes pratiques UX/UI

- **Grace period** configurable (30s a 5min selon le niveau de securite)
- Overlay de confidentialite dans l'app switcher (flou ou ecran generique)
- Si grace period depassee : demander Face ID d'abord, PIN en fallback
- Ne pas perdre le contexte de navigation (l'utilisateur revient ou il etait)
- Pour les apps bancaires : grace period courte (30s-1min)

### Implementation Pulpe iOS

**Passage en background (`handleEnterBackground()`) :**

```
1. Enregistre backgroundDate = Date()
2. Sync des donnees Widget si authenticated
3. Schedule un widget refresh en background
4. PrivacyShieldOverlay active (ecran opaque avec logo Pulpe)
```

**Retour au premier plan (`handleEnterForeground()`) :**

```
1. Verifier isBackgroundLockRequired :
   elapsed >= backgroundGracePeriod (30 secondes) && authState == .authenticated
2. Si grace period NON depassee :
   - Reprise immediate, pas de re-authentification
3. Si grace period depassee :
   a. clearCache() sur ClientKeyManager (efface la cle en memoire)
   b. Si biometricEnabled → tenter resolveBiometricKey()
      - Face ID accepte → reprise transparente
      - Face ID annule/echoue → authState = .needsPinEntry
   c. Si biometric non active → authState = .needsPinEntry directement
4. Dans tous les cas : forceRefresh() sur les stores (donnees fraiches)
```

**Privacy Shield :**

```
- Activee quand scenePhase != .active ET (authenticated OU needsPinEntry)
- Overlay : Color(.systemBackground) + logo Pulpe a 55% d'opacite
- Desactivee quand scenePhase == .active
- isRestoringSession = true pendant la verification (empeche le flash de contenu)
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Grace period | 30s-5min configurable | 30 secondes (fixe, non configurable par l'utilisateur) |
| Privacy overlay | Flou ou ecran generique | Ecran opaque avec logo (conforme, mieux que le flou) |
| Face ID puis PIN | Face ID d'abord, fallback PIN | Face ID en premier, PIN si echec (conforme) |
| Contexte navigation | Ne pas perdre la navigation | Navigation preservee (NavigationPath maintenu) |

---

## 8. Deconnexion (logout)

### Bonnes pratiques UX/UI

- Demander confirmation avant la deconnexion
- Supprimer tous les tokens (access + refresh) du Keychain
- Invalider les tokens cote serveur
- Nettoyer les donnees sensibles en memoire
- Retourner a l'ecran de login (pas l'onboarding)
- Si biometrique active : conserver les credentials pour reconnexion rapide

### Implementation Pulpe iOS

**Deux chemins selon l'etat biometrique :**

**Logout SANS biometrique :**

```
1. authService.logout()
   - supabase.auth.signOut(scope: .local) → revoque le refresh token
   - keychain.clearTokens() → efface access + refresh token du Keychain regulier
2. clientKeyManager.clearSession()
   - Efface la cle client du cache + Keychain regulier
   - Les tokens biometriques sont nettoyes (aucun n'existe)
```

**Logout AVEC biometrique :**

```
1. authService.saveBiometricTokens()
   - Rafraichit les tokens biometriques avec la session courante
   - Fallback : saveBiometricTokensFromKeychain() si la session SDK n'est pas disponible
2. authService.logoutKeepingBiometricSession()
   - resetClient() → recree le SupabaseClient (arrete l'auto-refresh)
   - keychain.clearTokens() → efface le Keychain regulier
   - NE FAIT PAS signOut(scope: .local) → le refresh token biometrique reste valide
3. clientKeyManager.clearSession()
   - Efface la cle client du cache + Keychain regulier
   - La cle client biometrique est PRESERVEE dans le Keychain biometrique
```

**Nettoyage commun :**

```
- currentUser = nil
- authState = .unauthenticated
- recoveryFlowState = .idle
- pendingRecoveryConsent = false
- enrollmentPolicy.resetForNewTransition()
- WidgetDataCoordinator().clear()
- WidgetCenter.shared.reloadAllTimelines()
- NavigationPath reset (budgetPath, templatePath)
- selectedTab = .currentMonth
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Confirmation avant logout | Dialogue de confirmation | Confirmation avec alerte : "Tu devras te reconnecter avec ton email et mot de passe." (conforme) |
| Invalidation serveur | Revoquer les tokens | Revoque uniquement si biometric desactive ; sinon garde le refresh token |
| Ecran post-logout | Ecran de login | LoginView si onboarding complete, sinon OnboardingFlow |
| Conservation biometrique | Optionnel mais recommande pour UX | Les tokens biometriques sont preserves pour reconnexion rapide (conforme) |

---

## 9. Reconnexion apres deconnexion

### Bonnes pratiques UX/UI

- Si biometrique etait active : proposer Face ID directement
- Sinon : ecran de login classique (email + mot de passe)
- Pré-remplir l'email si possible (ameliore l'UX)
- Permettre de changer de compte

### Implementation Pulpe iOS

**Cas 1 : Biometrique active (biometricEnabled == true)**

```
Au checkAuthState() :
  1. biometricEnabled charge depuis le Keychain → true
  2. Tokens biometriques existent (preserves lors du logout)
  3. attemptBiometricSessionValidation()
     - Face ID prompt
     - Si accepte : refresh tokens → resolvePostAuth()
       → .needsPinEntry (car la cle client session a ete effacee au logout)
     - Si annule : session reguliere invalide (tokens effaces) → .needsPinEntry
       (le Keychain regulier est vide, mais l'utilisateur a un vault configure)
  4. PinEntryView s'affiche avec bouton Face ID
```

**Cas 2 : Biometrique desactivee**

```
Au checkAuthState() :
  1. biometricEnabled charge depuis le Keychain → false
  2. authState = .unauthenticated
  3. hasCompletedOnboarding == true → LoginView affichee
  4. Email + mot de passe requis
  5. Apres login : resolvePostAuth() → .needsPinEntry (cle client absente)
  6. PinEntryView s'affiche (sans bouton Face ID)
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Face ID direct | Proposer si active | Prompt automatique au lancement (conforme) |
| Pre-remplir email | Ameliore l'UX | Dernier email sauvegarde dans le Keychain (`last_used_email`), pre-rempli au login (conforme) |
| Changement de compte | Permettre | Possible via "Nouveau sur Pulpe ?" ou saisie d'un autre email |

---

## 10. Kill de l'app et relance

### Bonnes pratiques UX/UI

- Meme comportement qu'un cold start
- Si biometrique active : prompt Face ID automatique
- Si biometrique desactivee : PIN ou login
- Ne pas perdre les donnees non sauvegardees (sauf si c'est attendu pour la securite)
- Les tokens Keychain survivent au kill process

### Implementation Pulpe iOS

**Comportement identique a un cold start (`checkAuthState()`) :**

```
1. Le process est tue → cache memoire perdu
2. Keychain regulier : tokens + cle client PRESENTS (pas effaces par le kill)
3. Keychain biometrique : tokens + cle client biometrique PRESENTS

MAIS :
4. checkAuthState() commence par clearSession()
   → Efface la cle client du Keychain regulier + cache
   → Force la re-authentification (PIN ou Face ID)
5. Le flow est identique a la section 4 (Face ID) ou 5 (PIN)
```

**En mode DEBUG :**

```
Si biometric desactive :
  - validateSession() tente de valider les tokens reguliers
  - Si valides → resolvePostAuth() (pas besoin de PIN)
  - Cela permet de rester connecte apres un restart Xcode
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Tokens survivent au kill | Oui via Keychain | Oui (conforme) |
| Re-authentification | Recommande pour apps financieres | Toujours requise (PIN ou Face ID) sauf DEBUG |
| Pas de perte de donnees | Donnees API-first | API est la source de verite, rien n'est perdu (conforme) |

---

## 11. Desinstallation et reinstallation

### Bonnes pratiques UX/UI

- **Keychain persiste** apres desinstallation sur iOS (comportement systeme)
- Bonne pratique : detecter un "first launch" via UserDefaults et nettoyer le Keychain
- Traiter l'utilisateur comme nouveau : exiger une reconnexion complete
- Ne pas auto-login avec d'anciens credentials (risque de securite si appareil revendu)
- UserDefaults sont effaces a la desinstallation → utiliser comme flag "first launch"

### Implementation Pulpe iOS

**Ce qui survit a la desinstallation (Keychain) :**

| Cle | Survit | Raison |
|-----|--------|--------|
| `biometric_enabled` (preference) | Oui | Stocke dans le Keychain regulier |
| `onboarding_completed` | Oui | Stocke dans le Keychain regulier |
| `access_token` | Oui | Stocke dans le Keychain regulier |
| `refresh_token` | Oui | Stocke dans le Keychain regulier |
| `client_key` | Oui | Stocke dans le Keychain regulier |
| `biometric_access_token` | Oui | Stocke dans le Keychain biometrique |
| `biometric_refresh_token` | Oui | Stocke dans le Keychain biometrique |
| `biometric_client_key` | Oui | Stocke dans le Keychain biometrique |

**Ce qui est perdu a la desinstallation :**

| Element | Perdu | Raison |
|---------|-------|--------|
| UserDefaults | Oui | Efface par iOS a la desinstallation |
| Cache memoire | Oui | Process detruit |
| Fichiers app (Documents/, Caches/) | Oui | Sandbox supprimee |

**Comportement au reinstall :**

```
1. App lance → PulpeApp.init()
2. checkAuthState() :
   a. biometricEnabled charge depuis Keychain → PEUT etre true (a survecu)
   b. onboardingCompleted charge depuis Keychain → PEUT etre true
3. clearSession() → efface client_key du Keychain regulier
4. Si biometricEnabled == true :
   - attemptBiometricSessionValidation()
   - Les tokens biometriques existent PEUT-ETRE encore
   - Si le refresh token est encore valide cote serveur → reconnexion Face ID reussie
   - Si expire → AuthServiceError → efface tout, biometricEnabled = false, login screen
5. Si biometricEnabled == false :
   - authState = .unauthenticated
   - Si onboardingCompleted == true → LoginView
   - Si onboardingCompleted == false → OnboardingFlow
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Detection "first launch" | UserDefaults flag + nettoyage Keychain | `clearKeychainIfReinstalled()` detecte via UserDefaults `hasLaunchedBefore` et appelle `clearAllData()` (conforme) |
| Nettoyage Keychain au reinstall | Recommande (securite) | Keychain nettoyee + `biometricEnabled = false` + `hasCompletedOnboarding = false` (conforme) |
| Auto-login apres reinstall | Deconseille | Auto-login desactive apres reinstall (conforme) |
| Flag onboarding | UserDefaults (efface au reinstall) | Keychain (survit au reinstall) → skip onboarding meme apres reinstall |

> **Risque identifie** : Si un utilisateur desinstalle et reinstalle l'app, il peut se retrouver
> connecte automatiquement via Face ID si les tokens n'ont pas expire. Sur un appareil revendu
> (sans reset), l'acheteur pourrait acceder au compte via Face ID s'il a enregistre son propre
> visage. Le flag `.biometryCurrentSet` mitige ce risque en invalidant les credentials si les
> biometries sont modifiees.

---

## 12. Desactivation de Face ID

### Bonnes pratiques UX/UI

- Toggle clair dans les reglages
- Demander confirmation ("Desactiver Face ID ?")
- Nettoyer les credentials biometriques immediatement
- L'app continue de fonctionner avec le PIN seul
- Pas de re-authentification necessaire pour desactiver

### Implementation Pulpe iOS

**Flow (`disableBiometric()`) :**

```
1. authService.clearBiometricTokens()
   - Efface biometric_access_token, biometric_refresh_token, biometric_client_key
2. clientKeyManager.disableBiometric()
   - Efface biometric_client_key du Keychain
3. biometricEnabled = false
   - Persiste dans le Keychain via BiometricPreferenceStore
```

**Consequence :**

- Au prochain background lock : seul le PIN sera demande
- Au prochain cold start : login email/mot de passe puis PIN
- Le bouton Face ID disparait du numpad PinEntryView

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Toggle dans les reglages | Oui | Present dans AccountView |
| Confirmation | Recommande | Alerte de confirmation : "Tu devras utiliser ton code PIN pour te connecter." (conforme) |
| Nettoyage immediat | Oui | Tous les tokens biometriques effaces (conforme) |

---

## 13. Code PIN oublie (recovery)

### Bonnes pratiques UX/UI

- Toujours avoir un mecanisme de recuperation (pas de "compte bloque")
- Recovery key ou question secrete ou email OTP
- Permettre de creer un nouveau PIN apres verification
- Re-chiffrer les donnees avec la nouvelle cle
- Logger l'evenement de recovery cote serveur

### Implementation Pulpe iOS

**Flow :**

```
PinEntryView → "Code PIN oublie ?" → PinRecoveryView

PinRecoveryView :
  1. L'utilisateur entre sa cle de recuperation (52 caracteres formates)
  2. Verification cote serveur
  3. Si valide → creation d'un nouveau PIN
  4. Derivation de la nouvelle cle client
  5. Re-chiffrement des donnees avec la nouvelle cle
  6. completeRecovery() (requires authState == .needsPinRecovery) → enterAuthenticated(.pinRecovery)
```

**Navigation :**

```
appState.startRecovery() → authState = .needsPinRecovery
Si annulation : appState.cancelRecovery() → authState = .needsPinEntry
Si succes : appState.completeRecovery() (requires authState == .needsPinRecovery, silent no-op otherwise)
        → enterAuthenticated(.pinRecovery)
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Mecanisme de recuperation | Requis | Recovery key 52 caracteres (conforme) |
| Creation nouveau PIN | Apres verification | Oui (conforme) |
| Re-chiffrement | Avec nouvelle cle | Oui (conforme) |

---

## 14. Reinitialisation du mot de passe

### Bonnes pratiques UX/UI

- Envoyer un lien par email avec deep link vers l'app
- Le lien expire apres un delai (15-60 min)
- Permettre de creer un nouveau mot de passe
- Invalider toutes les sessions existantes
- Rediriger vers le login apres le changement

### Implementation Pulpe iOS

**Flow :**

```
1. LoginView → "Mot de passe oublie ?" → ForgotPasswordSheet
2. Saisie email → AuthService.requestPasswordReset()
   - Supabase envoie un email avec deep link : pulpe://reset-password?...
3. L'utilisateur clique sur le lien → Deep link capture par PulpeApp
4. deepLinkDestination = .resetPassword(url:)
5. ResetPasswordFlowView s'affiche en sheet
   - AuthService.beginPasswordRecovery(from: url) → session de recovery
   - L'utilisateur saisit son nouveau mot de passe
   - AuthService.updatePassword(newPassword)
6. Si succes : completePasswordResetFlow()
   - authService.logout() → revoque les tokens
   - clearBiometricTokens() → nettoie tout
   - clientKeyManager.clearAll() → efface toutes les cles
   - biometricEnabled = false
   - Toast : "Mot de passe reinitialise, reconnecte-toi"
7. Si annulation : cancelPasswordResetFlow()
   - Meme nettoyage sans le toast de succes
```

**Ecarts avec les bonnes pratiques :**

| Point | Bonne pratique | Pulpe |
|-------|----------------|-------|
| Deep link email | Oui | Deep link Supabase (conforme) |
| Expiration du lien | 15-60 min | Gere par Supabase |
| Invalidation sessions | Toutes les sessions | Nettoyage complet local + biometrique (conforme) |
| Redirect vers login | Apres changement | Retour a .unauthenticated (conforme) |

---

## 15. Suppression de compte

### Bonnes pratiques UX/UI

- Demander confirmation explicite
- Delai de grace avant suppression definitive (7-30 jours)
- Informer l'utilisateur des consequences
- Nettoyer toutes les donnees locales
- Envoyer un email de confirmation

### Implementation Pulpe iOS

**Flow (`deleteAccount()`) :**

```
1. Appel API : AuthService.deleteAccount() → endpoint DELETE
2. Si succes :
   - hasCompletedOnboarding = false
   - logout() complet (efface tout)
3. Si erreur :
   - Toast : "La suppression du compte a echoue"
   - Pas de changement d'etat
```

**Le backend retourne :**
- `success: Bool`
- `message: String`
- `scheduledDeletionAt: String` (date de suppression planifiee)

---

## 16. Expiration de session

### Bonnes pratiques UX/UI

- Rafraichir les tokens automatiquement en background
- Si le refresh token expire : afficher un message clair et rediriger vers le login
- Ne pas perdre le contexte (sauvegarder l'etat de navigation)
- Informer l'utilisateur : "Ta session a expire, reconnecte-toi"

### Implementation Pulpe iOS

**Rafraichissement automatique :**

```
- Le SDK Supabase rafraichit automatiquement les tokens a chaque acces a supabase.auth.session
- AuthService.getAccessToken() sauvegarde les tokens frais dans le Keychain
```

**Detection de cle client perimee :**

```
- NotificationCenter : .clientKeyCheckFailed
- Declenchee quand le serveur rejette la cle client
- handleStaleClientKey() :
  1. clientKeyManager.clearAll()
  2. authState = .needsPinEntry → l'utilisateur doit re-saisir son PIN
```

**401 non-recuperable (refresh token invalide en cours de session) :**

```
APIClient.refreshTokenAndRetry() :
  1. Tente de recuperer un token frais via AuthService.getAccessToken()
  2. Si echec :
     a. AuthService.shared.logout() → nettoie les tokens
     b. NotificationCenter.post(.sessionExpired)
     c. PulpeApp ecoute → appState.handleSessionExpired()
        - clearSession(), currentUser = nil, authState = .unauthenticated
        - biometricError = "Ta session a expire, reconnecte-toi"
```

**Expiration complete (refresh token invalide au cold start) :**

```
PostAuthResolver :
- Si vault-status retourne 401 :
  1. Tente un refresh de session
  2. Si le refresh echoue → .unauthenticatedSessionExpired
  3. biometricError = "Ta session a expire, connecte-toi avec ton mot de passe"
  4. authState = .unauthenticated
```

---

## 17. Erreur reseau au lancement

### Bonnes pratiques UX/UI

- Distinguer "pas de reseau" de "serveur indisponible"
- Afficher un ecran dedié avec bouton "Reessayer"
- Ne pas bloquer l'acces hors-ligne si des donnees cachees existent
- Permettre le retry sans relancer l'app

### Implementation Pulpe iOS

**Flow :**

```
1. checkMaintenanceStatus() en premier
2. Si URLError → isNetworkUnavailable = true → NetworkUnavailableView
3. Si serveur erreur → isInMaintenance = true → MaintenanceView
4. Si OK → poursuivre avec checkAuthState()

NetworkUnavailableView :
  - Bouton "Reessayer"
  - retryNetworkCheck() → re-verifie maintenance + auth
```

---

## 18. Mode maintenance

### Implementation Pulpe iOS

```
1. MaintenanceService.shared.checkStatus() → endpoint de sante
2. Si le serveur indique maintenance → isInMaintenance = true
3. MaintenanceView affichee
4. Notification .maintenanceModeDetected ecoutee a tout moment
5. Quand maintenance se termine → onChange(of: isInMaintenance) → checkAuthState()
```

---

## 19. Cle client perimee en cours de session

### Implementation Pulpe iOS

```
1. Une requete API retourne une erreur de cle client invalide
2. Notification .clientKeyCheckFailed emise
3. handleStaleClientKey() :
   a. clientKeyManager.clearAll()
   b. authState = .needsPinEntry
4. L'utilisateur doit re-saisir son PIN pour deriver une nouvelle cle
```

---

## 20. Tableau comparatif des ecarts

Resume des differences majeures entre les bonnes pratiques et l'implementation actuelle.

### Ecarts critiques (securite/UX)

| # | Sujet | Bonne pratique | Pulpe | Impact |
|---|-------|----------------|-------|--------|
| 3 | PIN : limite de tentatives client | 5-6 tentatives avec lockout progressif | Aucune limite client (rate limit serveur seulement) | Securite : brute force hors-ligne non limitee |
| 4 | PIN : sequences interdites | Blocker 1234, 0000, etc. | Aucune restriction | Securite : PIN previsibles acceptes |

### Ecarts mineurs (ameliorations UX)

| # | Sujet | Bonne pratique | Pulpe | Impact |
|---|-------|----------------|-------|--------|
| 5 | Sign in with Apple | Recommande / obligatoire si SSO | Non implemente | UX : moins d'options de connexion |
| 6 | PIN : tentatives restantes | Afficher le compteur | Erreur generique sans compteur | UX : l'utilisateur ne sait pas combien de tentatives restent |
| 7 | Grace period configurable | L'utilisateur choisit (immediat, 1min, 5min) | Fixe a 30 secondes | UX : pas de personnalisation |
| 8 | Pre-remplir email au login | Memoriser le dernier email | Dernier email pre-rempli via Keychain (conforme) | - |
| 9 | PIN longueur | 6 chiffres recommande (banking) | 4 chiffres minimum accepte | Securite : espace de recherche plus petit |

### Points conformes

| Sujet | Implementation |
|-------|---------------|
| PIN : confirmation a la creation | 2 ecrans : saisie + confirmation (mode chooseAndSetupRecovery) |
| Reinstallation : nettoyage Keychain | Detectee via UserDefaults flag, keychain nettoyee automatiquement |
| Logout : confirmation | Dialogue de confirmation avant deconnexion |
| Face ID disable : confirmation | Dialogue de confirmation avant desactivation |
| Validation mot de passe temps reel | Criteres visibles en temps reel (8 chars, 1 chiffre) |
| Biometric : ne pas reproposer | Per-transition policy : retry autorise a chaque nouvelle transition d'authentification |
| Feedback haptique | Feedback sensory sur erreur et succes |
| Face ID opt-in | Alerte explicite avec choix |
| Face ID prompt unique | LAContext pre-authentifie |
| Fallback Face ID → PIN | Automatique |
| Privacy shield | Overlay opaque dans l'app switcher |
| Keychain protection | `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` |
| Biometric protection | `SecAccessControl(.biometryCurrentSet)` |
| Derivation cle | PBKDF2-SHA256, 600k iterations |
| Recovery key | 52 caracteres, sauvegarde utilisateur |
| API source de verite | Pas de stockage local de donnees metier |
| Token refresh automatique | SDK Supabase + sauvegarde Keychain |
| Navigation preservee | NavigationPath maintenu apres background |
| Deep link password reset | `pulpe://reset-password` (ignore si deja authentifie) |
| Pre-remplir email au login | Dernier email sauvegarde dans Keychain (`last_used_email`), efface a la suppression de compte |
| 401 non-recuperable | Notification `.sessionExpired` → AppState reset vers `.unauthenticated` |
| Logout biometrique resilient | Si sauvegarde tokens echoue → full logout au lieu de perte silencieuse de Face ID |
| Cold start cle stale | `biometricEnabled = false` apres `clearAll()` (coherent avec les autres paths) |
