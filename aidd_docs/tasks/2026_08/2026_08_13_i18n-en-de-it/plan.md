---
objective: "Pulpe s'affiche en anglais, allemand et italien sur la landing, la webapp et iOS, le français restant la langue par défaut et le fallback de toute clé manquante."
status: implemented
---

# Plan: Support multilingue EN / DE / IT

## Overview

| Field      | Value                                                                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Quatre langues (`fr` défaut · `en` · `de` · `it`) sur landing + webapp + iOS, préférence `locale` synchronisée par `/users/settings`, format des montants découplé de la langue |
| **Source** | Consigne `/aidd-dev:01-plan` du 2026-08-13 (texte brut) + exploration du dépôt et recherche Next.js / Transloco / Apple                                          |

Le français reste à la racine de la landing (aucune URL indexée ne bouge) et reste la langue de développement iOS (`CFBundleDevelopmentRegion`). Aucune copie française existante n'est réécrite.

Trois surfaces, trois coûts très différents : la webapp a déjà Transloco et un catalogue de 1502 clés — il lui manque trois fichiers et un sélecteur ; la landing n'a aucune infrastructure et ~280 chaînes en JSX ; iOS n'a qu'un `InfoPlist.strings` d'une ligne et 1400 à 2300 littéraux français répartis sur 358 fichiers Swift. La phase 0 arrête le contrat commun pour que les trois surfaces puissent ensuite fusionner dans n'importe quel ordre.

Hors périmètre, explicitement : emails transactionnels, notifications push distantes, métadonnées App Store, messages d'erreur serveur (déjà des codes `ERR_*` traduits côté client), notes de version (`landing/data/releases.json` et `whats-new`), RTL, toute langue au-delà de EN/DE/IT, le chiffrement et les calculateurs partagés. L'app Android Expo n'existe pas encore sur `preview` : elle héritera du contrat `locale` de la phase 0 sans travail supplémentaire ici.

## Phases

| #   | Phase                                                | File                           |
| --- | ---------------------------------------------------- | ------------------------------ |
| 0   | Contrat `locale` et décisions transverses            | [`phase-0.md`](./phase-0.md)   |
| 1   | Landing EN/DE/IT                                     | [`phase-1.md`](./phase-1.md)   |
| 2   | Webapp EN/DE/IT                                      | [`phase-2.md`](./phase-2.md)   |
| 3   | Relecture éditoriale EN/DE/IT (landing + webapp)     | [`phase-3.md`](./phase-3.md)   |
| 4   | iOS — socle de localisation                          | [`phase-4.md`](./phase-4.md)   |
| 5   | iOS — lot A : Core, Domain, Shared                   | [`phase-5.md`](./phase-5.md)   |
| 6   | iOS — lot B : Budgets, Templates                     | [`phase-6.md`](./phase-6.md)   |
| 7   | iOS — lot C : CurrentMonth, SavingsGoals             | [`phase-7.md`](./phase-7.md)   |
| 8   | iOS — lot D : Auth, Onboarding                       | [`phase-8.md`](./phase-8.md)   |
| 9   | iOS — lot E : Account, App, Widget + relecture iOS   | [`phase-9.md`](./phase-9.md)   |

Phases 1, 2 et 4→9 ne dépendent que de la phase 0. La phase 3 arrête le lexique définitif que les phases 4→9 consomment ; elle peut tourner en parallèle du socle iOS.

## Resources

| Source                                                                              | Verified                                                                                                                                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://jsverse.gitbook.io/transloco/getting-started/config-options                 | `missingHandler.useFallbackTranslation` vaut `false` par défaut ; c'est le seul commutateur qui couvre une clé manquante dans un catalogue chargé. `fallbackLang` ne couvre qu'un échec de chargement. |
| https://jsverse.gitbook.io/transloco/core-concepts/language-api                     | `setActiveLang` pour la bascule ; « Fallback translations for missing keys support a single language ».                                                                            |
| https://jsverse.gitbook.io/transloco/additional-functionality/utility-functions     | `getBrowserLang()` rend le code court (`de` pour `de-CH`) et `undefined` hors navigateur.                                                                                        |
| https://unpkg.com/@jsverse/transloco@8.2.1/fesm2022/jsverse-transloco.mjs           | Version installée : `useFallbackTranslation()` est bien indépendant de `fallbackLang` ; toute langue absente de `availableLangs` est traitée comme un **scope**, ce qui déforme l'URL du loader. |
| https://nextjs.org/docs/app/api-reference/file-conventions/layout                   | « Any layout without a layout.js above it is a root layout » — la base des deux root layouts `(fr)` + `[lang]`.                                                                    |
| https://nextjs.org/docs/app/guides/static-exports                                   | `output: 'export'` supprime proxy, rewrites, redirects et headers ; un Route Handler exige `export const dynamic = 'force-static'`.                                               |
| https://nextjs.org/docs/app/api-reference/file-conventions/not-found                | `global-not-found.js` existe précisément pour « multiple root layouts » ; expérimental, activé par `experimental.globalNotFound`.                                                 |
| https://next-intl.dev/docs/routing/middleware                                       | Sans middleware (export statique) next-intl impose `localePrefix: 'always'`, donc `/fr` — incompatible avec la contrainte « le français reste à la racine ».                       |
| https://developers.google.com/search/docs/specialty/international/localized-versions | Les `hreflang` doivent être réciproques et chaque version doit se lister elle-même, sinon Google ignore tout le cluster. `x-default` est le repli.                                 |
| https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites | « Avoid automatically redirecting users from one language version of a site to a different language version » — d'où le bandeau plutôt qu'une redirection.                         |
| https://developer.apple.com/videos/play/wwdc2021/10220/                             | L'environnement `\.locale` pilote bien la résolution des `LocalizedStringKey` SwiftUI, et explicitement **pas** celle de `NSLocalizedString`.                                     |
| https://developer.apple.com/forums/thread/771133                                    | Apple DTS : « changing SwiftUI locale environment only impacts the SwiftUI view hierarchy, and not the system-provided components ».                                              |
| https://developer.apple.com/forums/thread/718512                                    | Apple DTS : `AppleLanguages` « is an implementation detail, not something that's considered API » — approche écartée.                                                             |
| https://developer.apple.com/documentation/foundation/localizedstringresource/locale  | `LocalizedStringResource.locale` est la voie publique pour résoudre une chaîne hors de l'arbre SwiftUI (notifications, services).                                                 |
| https://developer.apple.com/documentation/swift/string/init(localized:table:bundle:locale:comment:) | Piège documenté : le paramètre `locale` de `String(localized:)` ne formate que les interpolations, il ne change pas la langue de recherche.                                       |
| https://developer.apple.com/forums/thread/743218                                    | `InfoPlist.xcstrings` fonctionne même avec un Info.plist généré par build settings.                                                                                               |

## Decisions

| Decision                                                                                                                       | Why                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codes de langue ISO 639-1 nus : `fr` `en` `de` `it`. Jamais de variante régionale.                                              | La région pilote déjà la devise (`CHF`→`de-CH`, `EUR`→`fr-FR`). Un `de-CH` créerait un second axe régional redondant et contradictoire. Un `de-CH` navigateur se replie sur `de` via `getBrowserLang()`.                    |
| La préférence vit dans `auth.users.user_metadata` via `PUT /v1/users/settings`, exactement comme `currency`. **Aucune migration, aucun `generate-types:local`.** | Il n'existe aucune table de réglages : `supabase-user.repository.ts:97-130` fait un read-merge-write du blob JSONB. Inventer une table pour un champ serait une divergence pure.                                             |
| Ordre de repli unique : clé manquante → `fr` ; catalogue introuvable → `fr`. Côté Transloco cela exige `fallbackLang: 'fr'` **et** `missingHandler.useFallbackTranslation: true`. | `fallbackLang` seul ne traite qu'un échec de chargement (et bascule la langue active). Le poser seul donnerait un chemin de clé brut à l'écran pour toute clé allemande manquante.                                          |
| Source de rendu au démarrage = snapshot local (`localStorage` `scope: 'app'` / `UserDefaults`), serveur = source de vérité, écriture immédiate au changement. | C'est déjà le contrat de `currency` (`storage-schemas.ts:57-62`), et `scope: 'app'` est porteur : il survit à la déconnexion, donc l'écran de connexion s'affiche dans la bonne langue.                                     |
| Un changement de langue **recharge** la webapp au lieu de re-rendre.                                                            | `LOCALE_ID` est résolu une seule fois par une factory DI synchrone (`locale.ts:51-55`) ; Angular ne sait pas le permuter à chaud. Le rechargement évite aussi de réécrire les 342 appels impératifs `.translate()` évalués à la construction. |
| Le format des montants suit la **devise**, jamais la langue d'interface. Les dates suivent la **langue**.                       | Mesuré : `CHF 1234.5` rend `CHF 1'234.50` en fr_CH/de_CH/en_CH mais `CHF 1234.50` en it_CH. Dériver le format monétaire de la langue casserait l'apostrophe suisse dès qu'un utilisateur passe en italien.                  |
| Landing : deux root layouts, `app/(fr)/` sans préfixe et `app/[lang]/` pour en/de/it, dictionnaires TypeScript nus, pas de next-intl. | Sous `output: 'export'` next-intl impose `localePrefix: 'always'` donc `/fr`, ce qui déplacerait toutes les URL françaises indexées. La contrainte du brief exclut la seule bibliothèque candidate.                          |
| Landing : aucune redirection automatique de langue. Un bandeau dismissible propose la version correspondante et mémorise la réponse. | Google demande explicitement d'éviter la redirection automatique entre versions linguistiques, et une redirection statique ne peut pas distinguer un visiteur qui a choisi sa langue à la main.                              |
| iOS : bascule par `.environment(\.locale, …)` sur la racine SwiftUI, plus `LocalizedStringResource.locale` hors de l'arbre. Jamais `AppleLanguages`, jamais de swizzle de `Bundle`. | `AppleLanguages` est déclaré non supporté par Apple DTS et exige un relancement. L'environnement SwiftUI bascule sans redémarrage — sous réserve du spike de la phase 4, dont dépend tout le reste.                          |
| `pnpm test:lexicon` scanne les quatre catalogues avec une liste de mots interdits **par langue**, pas une liste unique.          | Le mot « transaction » est une règle de vocabulaire produit, pas de langue française : il faut aussi interdire `transaction` en anglais, `Transaktion` en allemand, `transazione` en italien. Un `readdir` naïf ferait échouer en.json dès le premier jour. |
| `/changelog` et les notes de version restent en français sur les quatre langues.                                               | `landing/data/releases.json` est un contrat inter-paquets : `releases-data.parity.spec.ts:114` exige l'égalité verbatim avec le backend. Le traduire casserait un test dans un autre paquet pour un gain marginal.           |
