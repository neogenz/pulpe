# Implementation Plan: Turnstile Safari iOS Bypass

## Overview

Modifier le backend pour accepter les tokens Turnstile vides en production/preview. La sécurité est maintenue par le rate limiting existant (30 req/h/IP). Changement minimal d'une seule ligne avec mise à jour des tests.

## Dependencies

Aucune - le rate limiting est déjà configuré et actif.

## File Changes

### `backend-nest/src/common/services/turnstile.service.ts`

- **Action**: Modifier la condition qui rejette les tokens vides (L52-55)
- **Changement**: Remplacer `return false` par `return true` pour les tokens vides
- **Logging**: Changer le niveau de log de `warn` à `info` pour indiquer que c'est un comportement attendu
- **Commentaire**: Ajouter un commentaire expliquant que la protection est maintenue par rate limiting
- **Pattern**: Suivre le même pattern que le skip en non-production (L47-50)

### `backend-nest/src/common/services/turnstile.service.spec.ts`

- **Action**: Mettre à jour le test "should return false if token is empty" (L112-116)
- **Changement**: Le test doit maintenant s'attendre à `true` au lieu de `false`
- **Renommer**: Renommer le test en "should return true if token is empty (rate-limited)"
- **Ajouter**: Vérifier que le fetch n'est pas appelé (comportement inchangé)

## Testing Strategy

### Tests unitaires

- **Mettre à jour**: `turnstile.service.spec.ts` L112-116
- **Vérifier**: Token vide retourne `true` en production
- **Vérifier**: Cloudflare API n'est PAS appelée pour token vide

### Tests manuels

1. Déployer sur Railway preview
2. Accéder à l'app depuis Safari iOS
3. Cliquer sur "Essayer le mode démo"
4. Vérifier que la session démo se crée sans erreur 403

## Documentation

Aucune mise à jour nécessaire - le comportement est déjà documenté côté frontend.

## Rollout Considerations

- **Breaking change**: Non - le changement est rétrocompatible
- **Feature flag**: Non nécessaire - changement simple et réversible
- **Monitoring**: Les logs `info` permettront de tracer l'utilisation du bypass
