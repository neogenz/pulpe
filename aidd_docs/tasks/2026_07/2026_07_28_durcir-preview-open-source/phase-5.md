---
status: done
---

# Instruction: Durcir la télémétrie identifiée sans casser le support

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs
│   ├── CONSENT.md ✏️
│   └── MONITORING.md ✏️
├── landing
│   ├── components/PostHogProvider.tsx ✏️
│   └── lib/posthog.ts ✏️
├── frontend/projects/webapp/src/app
│   ├── core
│   │   ├── analytics
│   │   │   ├── analytics.ts ✏️
│   │   │   ├── analytics.spec.ts ✏️
│   │   │   ├── posthog-sanitizer.ts ✏️
│   │   │   ├── posthog-sanitizer.spec.ts ✏️
│   │   │   ├── posthog.ts ✏️
│   │   │   └── posthog.spec.ts ✏️
│   ├── feature
│   │   ├── legal/components/privacy-policy.ts ✏️
│   │   └── settings
│   │       ├── settings-page.ts ✏️
│   │       └── settings-page.spec.ts ✏️
│   └── ui/dialogs/recovery-key-dialog.ts ✏️
├── frontend/projects/webapp/public/i18n/fr.json ✏️
└── ios
    ├── Config/Base.xcconfig ✏️
    ├── project.yml ✏️
    ├── Pulpe
    │   ├── Core/Analytics
    │   │   └── AnalyticsService.swift ✏️
    │   ├── Core/Config/AppConfiguration.swift ✏️
    │   ├── Features/Account/PreferencesView.swift ✏️
    │   └── Resources
    │       ├── Info.plist ✏️
    │       └── PrivacyInfo.xcprivacy ✏️
    └── PulpeTests/Core/Analytics/AnalyticsServiceTests.swift ✏️
```

## Tasks to do

### `1)` Conserver l’identification utile et réduire la collecte

> Faire correspondre un compte Supabase à sa chronologie PostHog sans collecter le contenu métier.

1. Conserver comme `distinct_id` l’UUID Supabase et comme propriétés de personne l’email et le prénom nécessaires au support.
2. Conserver les événements manuels, erreurs assainies et changements de page utiles; ne jamais envoyer montant, libellé financier, clé de récupération, token ni contenu saisi.
3. Retirer le handoff `ph_did` et la persistance cross-domain de la landing: l’acquisition publique n’a pas besoin d’être rattachée à l’identité du compte.
4. Forcer le session replay à l’arrêt en production; garder son activation par configuration uniquement en local et preview.

### `2)` Ajouter un opt-out local avec les primitives PostHog

> Réutiliser le stockage du SDK: aucun champ Supabase, endpoint ou système de consentement parallèle.

1. Web: exposer dans le service central les états et actions PostHog natifs `has_opted_out_capturing`, `opt_out_capturing` et `opt_in_capturing`.
2. iOS: utiliser les primitives natives `optOut` et `optIn` du SDK et leur persistance locale.
3. À la désactivation, arrêter toute capture et tout replay éventuel, puis effacer l’association locale à l’identité sans perdre le choix d’opt-out; à la réactivation, identifier à nouveau l’utilisateur authentifié.
4. Laisser le partage activé par défaut sur chaque appareil. Le réglage reste propre à l’appareil et à la plateforme.

### `3)` Exposer un réglage discret, standard et compréhensible

> Ajouter le minimum d’interface dans les écrans de préférences existants.

1. Web: ajouter une section après « Sécurité » et avant « Zone de danger » dans la page de réglages existante, avec `MatSlideToggle`.
2. iOS: ajouter une dernière section « Données et confidentialité » dans `PreferencesView`, avec le `Toggle` SwiftUI natif.
3. Utiliser le même libellé: « Partager les diagnostics ».
4. Utiliser cette explication courte: « Associe à ton compte les événements techniques et erreurs pour comprendre les problèmes et t’aider plus rapidement. Aucun montant ni contenu saisi n’est collecté. »

#### Wireframe web

```txt
┌─────────────────────────────────────────────────────────────┐
│ Données de diagnostic                                      │
│ Associe à ton compte les événements techniques et erreurs  │
│ pour comprendre les problèmes et t’aider plus rapidement.  │
│ Aucun montant ni contenu saisi n’est collecté.              │
│                                                             │
│ Partager les diagnostics                              [●──] │
└─────────────────────────────────────────────────────────────┘
```

#### Wireframe iOS

```txt
DONNÉES ET CONFIDENTIALITÉ
┌──────────────────────────────────────┐
│ Partager les diagnostics       [●─] │
└──────────────────────────────────────┘
Associe à ton compte les événements techniques et erreurs
pour comprendre les problèmes et t’aider plus rapidement.
Aucun montant ni contenu saisi n’est collecté.
```

### `4)` Défendre les données sensibles et aligner les déclarations

> Centraliser la protection afin qu’aucun appelant ne puisse la contourner.

1. Maintenir le sanitizer web en fail-closed et marquer la clé de récupération `ph-no-capture`.
2. Tester que les chemins d’identification ne transmettent que l’UUID Supabase, l’email et le prénom; tester le rejet des montants, clés, tokens et textes métier.
3. Tester que l’opt-out bloque les captures web et iOS, réinitialise l’identité et que l’opt-in ré-identifie la session authentifiée.
4. Tester qu’un build production ne peut pas démarrer le session replay, tandis que local et preview restent contrôlés par leur configuration.
5. Mettre `CONSENT.md`, `MONITORING.md`, la politique de confidentialité et le privacy manifest iOS en accord avec la collecte réellement livrée, sans conclure à une conformité juridique non revue.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Une session authentifiée web ou iOS est retrouvable dans PostHog par UUID Supabase ou email, sans montant, libellé, clé, token ni contenu saisi; aucune identité landing n’est transférée à l’app. |
| 2 | Le choix est activé par défaut, persiste localement, bloque toute capture immédiatement quand il est désactivé et ré-identifie correctement après réactivation. |
| 3 | Le réglage réutilise les pages et contrôles natifs existants, sans nouvelle route, table, API, dépendance ni composant de design. |
| 4 | Le session replay est impossible en production, reste configurable en local/preview, la clé de récupération est exclue de toute capture et les déclarations correspondent au comportement testé. |
