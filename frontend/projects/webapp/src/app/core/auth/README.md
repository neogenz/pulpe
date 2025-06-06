# Localisation des erreurs d'authentification

## Vue d'ensemble

Ce module fournit une solution pour localiser en français les messages d'erreur renvoyés par Supabase Auth.

## Architecture

### AuthErrorLocalizer

Service responsable de la traduction des messages d'erreur de l'anglais vers le français.

**Fonctionnalités :**

- Traduction directe des messages d'erreur courants
- Détection automatique des types d'erreurs (mot de passe faible, limite de débit, réseau)
- Message par défaut pour les erreurs non reconnues

### Intégration avec AuthService

Le service `AuthService` utilise automatiquement `AuthErrorLocalizer` pour localiser toutes les erreurs avant de les retourner aux composants.

## Messages supportés

### Erreurs de connexion

- `Invalid login credentials` → `Email ou mot de passe incorrect`
- `Email not confirmed` → `Veuillez confirmer votre email avant de vous connecter`
- `Too many requests` → `Trop de tentatives de connexion. Veuillez réessayer plus tard`

### Erreurs d'inscription

- `User already registered` → `Cet email est déjà utilisé`
- `Signup requires a valid password` → `Le mot de passe doit être valide`
- `Password should be at least 6 characters` → `Le mot de passe doit contenir au moins 6 caractères`

### Erreurs de réseau et autres

- `Network request failed` → `Erreur de réseau. Vérifiez votre connexion internet`
- Messages contenant "weak password" → `Le mot de passe doit contenir au moins 8 caractères avec des lettres et des chiffres`

## Usage

Le service est automatiquement utilisé par `AuthService`. Aucune configuration supplémentaire n'est nécessaire dans les composants.

```typescript
// Dans login.ts - l'erreur est automatiquement localisée
const result = await this.authService.signInWithEmail(email, password);
if (!result.success) {
  this.errorMessage.set(result.error); // Déjà en français
}
```

## Extensibilité

Pour ajouter de nouveaux messages, modifiez le dictionnaire `errorTranslations` dans `AuthErrorLocalizer` :

```typescript
private readonly errorTranslations: AuthErrorTranslations = {
  'New English Error': 'Nouvelle erreur en français',
  // ... autres messages
};
```
