---
objective: "Un utilisateur Pulpe branche son compte dans ChatGPT, Claude ou Codex, autorise l'accès depuis une page Pulpe, pilote son budget en langage naturel, et coupe l'accès quand il veut."
status: blocked
---

# Plan: Connecteur MCP Pulpe pour agents IA

## Overview

| Field      | Value                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| **Goal**   | Exposer Pulpe comme serveur MCP distant authentifié, publié dans les annuaires OpenAI et Anthropic |
| **Source** | Linear PUL-345 et ses filles PUL-346, PUL-347, PUL-348, PUL-349, PUL-350   |

## Phases

| #   | Phase                                | File                         |
| --- | ------------------------------------ | ---------------------------- |
| 1   | Socle MCP authentifié                | [`phase-1.md`](./phase-1.md) |
| 2   | Consentement et clé enveloppée       | [`phase-2.md`](./phase-2.md) |
| 3   | Connexions et révocation, web        | [`phase-3.md`](./phase-3.md) |
| 4   | Connexions et révocation, iOS        | [`phase-4.md`](./phase-4.md) |
| 5   | Les quinze outils métier             | [`phase-5.md`](./phase-5.md) |
| 6   | Publication dans les annuaires       | [`phase-6.md`](./phase-6.md) |

## Resources

| Source                                                                                                          | Verified                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices                        | Audience obligatoire, token passthrough interdit (`MUST NOT`), poignée d'état liée serveur à l'utilisateur, minimisation des scopes |
| https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/                                          | Spec `2026-07-28` sans état, `Mcp-Session-Id` supprimé, élicitation via `InputRequiredResult`                                    |
| https://supabase.com/docs/guides/auth/oauth-server/getting-started                                                | Supabase est authorization server OAuth 2.1. Seuls `openid`/`email`/`profile`/`phone` sont documentés ; les scopes custom ne sont mentionnés nulle part (constat d'absence, re-vérifié 2026-08-28 — la doc n'énonce pas d'interdiction explicite) |
| https://supabase.com/docs/guides/auth/oauth-server/oauth-flows                                                    | Écran de consentement = notre frontend. `getAuthorizationDetails` / `approveAuthorization` / `denyAuthorization`. Pas d'octroi partiel de scopes. `getUserGrants()` et `revokeGrant(clientId)` |
| https://github.com/orgs/supabase/discussions/41695                                                                | CIMD non implémenté, discussion sans réponse mainteneur. DCR à match exact sur `redirect_uri`, casse les clients à port éphémère |
| https://developers.openai.com/plugins/guides/submit-claude-plugin                                                 | `.claude-plugin/plugin.json` converti en `.codex-plugin/plugin.json`, MCP HTTP repris tel quel. `marketplace.json`, `.mcp.json` et stdio local exclus |
| https://developers.openai.com/plugins/deploy/submission                                                           | Identité vérifiée obligatoire, URL de prod publique, compte de démo sans MFA, annotations exactes par outil                      |
| https://claude.com/docs/connectors/building/submission                                                            | Portail dans les réglages d'organisation, indisponible sur les plans individuels. Auth acceptée : DCR, CIMD, ou client ID fixe détenu par Anthropic. Sept déclarations de conformité |
| Re-vérification du 2026-08-28 (tip `a1e779d2d`)                                                                    | Gates rejoués : `lint:arch` ✅ · `bun test` 1544/1544 ✅ · `ng test` 3063/3063 ✅ · public-surface ✅ · lexicon ✅ · ci-security ✅. Claims backend, webapp, iOS, plugin et landing confirmés sur pièces. Sources externes re-confirmées (spec MCP 2026-07-28, Supabase OAuth, portails OpenAI et Anthropic). Restent ouverts : spike Claude Code et Codex CLI, `xcodebuild test` — repris en phase 6 |

## Decisions

| Decision                                                                                                       | Why                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Le serveur MCP est un consommateur des ports Pulpe, pas une entrée dans le pipeline de chiffrement             | Il déballe le `clientKey`, le pose en CLS comme `AuthGuard`, et les use cases existants tournent inchangés. Zéro modification des repositories, zéro nouveau chemin de déchiffrement, la frontière de chiffrement reste unique |
| L'enveloppe réutilise les primitives AES-GCM existantes de `aes-gcm.crypto-service.ts`                          | `wrapDEK` / `unwrapDEK` et la colonne `wrapped_dek` existent déjà pour la clé de récupération. Même primitive, même format, aucune crypto nouvelle à auditer                          |
| Supabase reste l'authorization server, aucun AS écrit                                                          | Le serveur OAuth 2.1 de Supabase couvre discovery, PKCE, jetons et grants. Écrire un AS pour un projet solo serait la pire dette possible                                            |
| Le mode lecture ou écriture est porté par Pulpe, pas par les scopes OAuth                                       | Supabase ne connaît pas les scopes custom et n'accorde pas de sous-ensemble. La permission vit donc dans la ligne `mcp_connection` et se traduit par un filtrage de `tools/list`                      |
| La surface exposée suit les usages, pas les endpoints                                                          | Une soixantaine d'endpoints dégraderait la sélection du modèle et multiplierait la surface de revue. Quinze outils métier couvrent les mêmes usages                                  |
| Rien n'est construit contre le DCR de Supabase avant d'avoir constaté un échec réel                             | Le risque est documenté mais ne touche que les clients locaux. ChatGPT et Claude Desktop utilisent des URL fixes, et Anthropic offre un client ID fixe. Construire un bridge à l'aveugle serait de la dette spéculative |
| Les outils appellent les use cases Pulpe en process, jamais l'API par HTTP                                      | Retransmettre le Bearer entrant contredit l'interdiction de passthrough, et `AuthGuard` ne vérifie aucune audience (`getUser()` seul) : un jeton MCP accepté par accident deviendrait un confused deputy. Le garde MCP valide le JWT, charge `mcp_connection`, déballe le `clientKey`, pose `user` et `clientKey` en CLS comme le fait `AuthGuard`, puis les outils injectent des **ports exportés** par les modules métier (`useExisting` sur le use case, comme `BUDGET_PROVISIONING_PORT`). `no-cross-module-direct` (ADR-0002) interdit d'importer l'`application/` d'un autre module. Phase 1 n'ajoute que deux ports ; phase 5 les autres. Pas de `PulpeApiPort`, pas de client HTTP |
| Le JWT authentifie, la ligne `mcp_connection` autorise                                                         | Un jeton d'accès reste valide jusqu'à expiration : seule la ligne reflète une révocation immédiate. Le mode vit dans la ligne, pas dans un claim ni un Custom Access Token Hook. Clé : `(user_id, client_id)`. Le spike doit constater sous quel claim `client_id` apparaît dans le jeton, deux agents d'un même utilisateur devant rester distincts |
| Changement de code PIN et récupération révoquent toutes les connexions juste après le rekey, en best effort (échec journalisé, jamais remonté — arbitré en review) | `changePinRekey` et la récupération dérivent un nouveau `clientKey` : les copies enveloppées deviennent mortes, l'accès agent est donc coupé même si le marquage de la ligne échoue. Révoquer coûte un appel, réenvelopper exigerait de tenir l'ancien et le nouveau `clientKey` ensemble. L'utilisateur réautorise en dix secondes. Sens inverse de la même règle : `encryption` et `user` injectent un port `REVOKE_AGENT_CONNECTIONS_PORT` déclaré dans `mcp/domain/ports/`, implémenté et exporté par `McpModule`. `wrapDEK` n'est pas sur `EncryptionPort` : l'y exposer plutôt qu'importer le service, sinon `lint:arch` échoue |
| Aucune notification à l'autorisation                                                                           | Pas de canal de notification dans le backend aujourd'hui. L'écran Connexions est la trace visible ; construire un canal pour un seul message serait de la dette |
