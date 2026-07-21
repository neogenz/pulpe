# Review: Tags, filtres et catalogue multi-plateforme

- **Verdict**: approved
- **Diff**: `7594bb035...worktree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_16
- **Findings**: 0 critical, 0 warnings, 0 minor

## Phases

### Phase 1 : Tags des transactions allouées

- [x] Le panneau résout les tags d’une transaction allouée et réutilise le vrai `TagIndicator`.
- [x] Deux tags rendent le compte `2` et exposent `Assurance` et `Bureau` dans le libellé accessible.
- [x] Sans tag, aucune pastille ni icône n’est rendue.
- [x] Pointage, édition et suppression restent inchangés.

### Phase 2 : Filtre des tags des transactions allouées

- [x] Un tag porté par une transaction allouée conserve sa prévision parente dans les résultats.
- [x] Les tags directs, la logique OR et le recomptage des groupes restent couverts.
- [x] Le scénario est couvert au niveau utilitaire et au niveau conteneur.

### Phase 3 : Espacement du header d’historique

- [x] Le header Material reçoit un padding supérieur de 24 px via `pt-6!`.
- [x] Le titre, le sous-titre et le bouton de fermeture restent présents.
- [x] Le test de régression vérifie le token d’espacement.

### Phase 4 : Catalogue de tags web

- [x] `/settings` expose une entrée vers `/settings/tags` sans retirer les sections existantes.
- [x] La page lit le catalogue partagé du `TagStore`, avec états chargement, erreur récupérable, vide et liste.
- [x] Aucun stockage parallèle ni contrôle de création, renommage ou suppression n’est ajouté.
- [x] Les 4 tests de la page passent et le build Angular de production réussit.

### Phase 5 : Catalogue de tags iOS

- [x] Le client lit `/tags` depuis le backend, sans persistance locale distincte.
- [x] L’écran distingue chargement, erreur récupérable, vide et liste, avec libellés VoiceOver.
- [x] Le ViewModel est co-localisé avec la vue conformément à l’architecture iOS.
- [x] XcodeGen ne conserve aucune référence au fichier supprimé et les 3 tests du ViewModel passent.

## Findings

Aucun finding bloquant ou actionnable dans le code revu. Les deux findings précédents sont fermés.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 95% (19/20) |
| Automated | 36 tests web ciblés, 3 tests iOS ciblés, `pnpm build`, `pnpm quality` 10/10 |
| Unchecked | Parcours visuel authentifié dans le navigateur ; aucun frontend n’a été lancé pour éviter un nouveau serveur de worktree |
| Non-blocking | Warning Angular de budget initial à 1,46 MB ; 33 warnings backend préexistants, 0 erreur |
| Unplanned | none |
