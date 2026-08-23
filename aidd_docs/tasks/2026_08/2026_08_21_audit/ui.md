# Audit Android — UI/UX, accessibilité et i18n

- Date : 2026-08-21
- Périmètre : états d'écran, design system, responsive, TalkBack statique et catalogues FR/EN/DE/IT
- Santé : **bonne cohérence visuelle, interactions modales perfectibles**

## Findings

| Sev | Category           | Location                               | Issue                                                                                                                                                                                                                                                                                         | Suggested fix                                                                                                                                                            | Effort |
| --- | ------------------ | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 🟡  | Android UX         | `android/src/core/ui/sheet.tsx:67`     | Les 17 consommateurs nommés `*Sheet` rendent en réalité un `Modal` centré avec simple fade : pas de poignée, swipe-to-dismiss ni mouvement de surface. Le même écart d'interaction touche toutes les créations/éditions; il est déjà documenté comme nécessitant une validation sur appareil. | Valider une fois clavier/footer/gestes sur appareil puis remplacer l'implémentation partagée par une vraie bottom sheet; sinon assumer et renommer le pattern en dialog. | M      |
| 🟢  | i18n/accessibility | `android/src/core/tips/tooltip.tsx:61` | Le bouton de fermeture TalkBack porte toujours `accessibilityLabel="Fermer le conseil"`, même en EN/DE/IT.                                                                                                                                                                                    | Utiliser une clé de catalogue existante (`common.close`) ou une clé dédiée traduite.                                                                                     | S      |

## Top actions

1. Trancher le pattern modal sur appareil au niveau du composant partagé, pas dans 17 écrans.
2. Éliminer le dernier label TalkBack français en dur.

## Coverage

- Vérifiés : quatre catalogues et leur parité, chaînes TSX en dur, couleurs/tokens, reduced motion, touch targets, loading/error/empty states principaux et chemins de retry.
- Points sains : couleurs applicatives centralisées dans `theme.ts`, copie produit cataloguée, reduced motion du gate respecté, erreurs de détail séparées des états vides.
- Limites : aucune inspection visuelle, TalkBack, clavier réel, mode paysage, grand texte extrême ou capture multi-device; le predictive back reste explicitement bloqué par la pile Expo Router actuelle et n'est pas compté comme nouveau finding.
