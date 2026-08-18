---
objective: "Les huit findings de la revue Android sont soldés, les contrôles locaux et distants sont verts, et le SHA revu passe un smoke test depuis la piste interne Google Play."
status: in-progress
---

# Plan: corriger les findings de la revue Android et prouver la livraison Play

## Overview

| Field      | Value                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**   | Fermer les défauts de session et de cache, rendre le diagnostic Expo fiable, puis valider l'AAB signé par Play avec l'ami testeur.                           |
| **Source** | [`review.md`](../2026_08_17_android-play-internal-readiness/review.md), revue de la PR [#608](https://github.com/neogenz/pulpe/pull/608) au SHA `9d8f77c9e`. |

## Phases

| #   | Phase                                                           | File                         |
| --- | --------------------------------------------------------------- | ---------------------------- |
| 1   | Fermer toute session locale de façon déterministe               | [`phase-1.md`](./phase-1.md) |
| 2   | Rafraîchir les objectifs et distinguer erreur de donnée absente | [`phase-2.md`](./phase-2.md) |
| 3   | Rendre le signal Expo/EAS et la documentation exacts            | [`phase-3.md`](./phase-3.md) |
| 4   | Livrer et tester l'AAB signé par Google Play                    | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                  | Verified                                                                                           |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| https://supabase.com/docs/reference/javascript/auth-signout             | `local` retire la session persistée ; `global` révoque toutes les sessions.                        |
| https://github.com/supabase/auth/blob/master/internal/models/user.go    | Un changement de mot de passe révoque déjà les autres sessions, en conservant la session courante. |
| https://docs.expo.dev/modules/autolinking/                              | L'autolinking et son contrôle de doublons peuvent être bornés au graphe de l'app.                  |
| https://support.google.com/googleplay/android-developer/answer/14316361 | Un compte personnel neuf exige un appareil physique non rooté sous Android 10 ou plus.             |
| https://support.google.com/googleplay/android-developer/answer/9845334  | La piste interne accepte une liste d'un testeur et distribue les AAB via Play.                     |
| https://support.google.com/googleplay/android-developer/answer/9842756  | L'empreinte de signature Play, différente de la clé d'upload, est celle reçue par le testeur.      |

## Decisions

| Decision                                                        | Why                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Conserver React `19.2.3` dans Android et `19.2.8` dans Landing. | Chaque app garde sa version compatible ; aucun override racine ni downgrade ne masque le vrai graphe natif.         |
| Ne jamais supprimer directement une clé interne Supabase.       | Le teardown passe par l'API publique et l'adaptateur de stockage testé, sans dépendre d'un nom de clé privé du SDK. |
