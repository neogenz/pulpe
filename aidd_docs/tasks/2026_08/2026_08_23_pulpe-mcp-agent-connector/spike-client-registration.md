# Spike: inscription des clients MCP contre le serveur OAuth 2.1 de Supabase

Objectif : savoir si le DCR de Supabase suffit aux quatre clients visés avant d'écrire une
couche de registre client.

## Constats vérifiés (2026-08-23, local)

| Question | Réponse | Preuve |
| --- | --- | --- |
| Sous quel claim apparaît le client ? | `client_id` (chaîne), à côté des claims habituels `sub`, `role`, `session_id` | Doc Supabase « access tokens include `client_id` » ; `McpTokenGuard` lit ce claim |
| Sous quel claim apparaît l'audience ? | `aud` reste `authenticated`. Supabase n'implémente pas les resource indicators (RFC 8707) ; seul un Custom Access Token Hook peut y mettre l'URL du serveur | Doc Supabase « Set the `aud` claim to the third-party API endpoint via Custom Access Token Hooks » |
| Deux agents d'un même utilisateur restent-ils distinguables ? | Oui, par `client_id` | Clé `(user_id, client_id)` du port `MCP_CONNECTION_REPOSITORY` |
| GoTrue accepte-t-il un JWT forgé hors session ? | Non : `session_not_found` si `session_id` ne correspond à aucune session vivante | `curl /auth/v1/user` avec un JWT signé par le secret local mais `session_id` inventé |

Conséquence retenue : le garde MCP exige `client_id` et n'accepte pour `aud` que
`authenticated` ou `MCP_RESOURCE_URL` ; `AuthGuard` rejette tout jeton porteur de
`client_id`. Tant qu'aucun hook ne pose l'URL dans `aud`, la séparation des deux surfaces
repose sur `client_id`, pas sur l'audience.

Vérifié en local (`probe.sh`, backend sur :3077, Supabase local) :

- sans jeton → `401` + `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource/mcp"` ;
- jeton utilisateur sans `client_id` → `401` ; jeton `client_id` avec `aud` étranger → `401` ;
- jeton `client_id` sur `GET /api/v1/budgets` → `401 ERR_AUTH_TOKEN_INVALID` ;
- jeton `client_id` valide + connexion de test → `initialize`, `tools/list`, `get_current_month`
  (montants déchiffrés identiques à l'app), `add_movement` (mouvement visible via REST) ;
- mode `read` → seul `get_current_month` listé, appel direct de `add_movement` refusé.

## Reste à constater par client (nécessite un compte humain sur chaque client)

Préalable fait le 2026-08-23 sur le projet **preview** (`lrphlfjkzkwyllejanrd`) : serveur OAuth
2.1 activé, `authorization_url_path = /mcp-consent`, DCR activé ; metadata publiée sur
`/auth/v1/.well-known/oauth-authorization-server` avec `registration_endpoint`.
Serveur MCP publié (2026-08-23) : environnement Railway `mcp-spike` (projet `pulpe-backend`,
forké de `preview`, branche `cursor/0d3766ab`), `https://backend-mcp-spike.up.railway.app/mcp`,
`MCP_TEST_ACCESS_MODE=read_write`. Compte de test preview `mcp-spike@pulpe.test` (PIN 1234,
budget 8/2026) ; `MCP_TEST_CLIENT_KEY` = sa clé client dérivée. À supprimer après le spike.

Chaîne OAuth vérifiée sans navigateur (`oauth-e2e.py`) contre cette URL : DCR `201` avec
`redirect_uri` `http://localhost:<port>/callback` → `authorize` `302` vers
`…/welcome/mcp-consent?authorization_id=…` → approbation via
`POST /auth/v1/oauth/authorizations/{id}/consent` avec le JWT utilisateur → code → jeton portant
`client_id` et `aud: authenticated` → `tools/list` et `get_current_month` `200` avec les montants
déchiffrés. Les clients ci-dessous s'arrêteront à la page de consentement tant que la phase 2 ne
l'a pas livrée ; le spike constate donc l'inscription et la redirection, pas la connexion finale.

Dette connue : le Site URL preview se termine par `/welcome`, donc l'URL de consentement
générée est `…/welcome/mcp-consent`. À corriger en phase 2 (Auth → URL Configuration, Site URL
sans `/welcome`, puis retester confirmation et reset e-mail), quand la page existe.

| Client | URL de redirection | Connexion aboutit ? | Erreur exacte sinon |
| --- | --- | --- | --- |
| ChatGPT (mode développeur, « New Plugin ») | `chatgpt.com/connector/oauth/<id>` (un par connecteur, pas l'URL générique) | **Oui** (2026-08-23) : DCR → `authorize` avec `resource=` (RFC 8707, ignoré par Supabase) → consentement approuvé via l'API → callback → « Pulpe spike is now connected » → `get_current_month` rend 2’960 dans le chat | |
| Claude (claude.ai web, même client OAuth `Claude` que Claude Desktop) | fixe (`claude.ai/api/mcp/auth_callback`) | **Oui** (2026-08-23) : DCR → redirection `…/welcome/mcp-consent` (404, page phase 2) → consentement approuvé via l'API → callback claude.ai → outils listés, classés read-only / write par les annotations → `get_current_month` rend 2 960 CHF dans le chat | |
| Claude Code | `localhost:<port éphémère>` | à constater (risque DCR à match exact, discussion supabase#41695) | |
| Codex CLI | `localhost:<port éphémère>` | à constater (même risque) | |

Décision : aucune couche de registre client tant qu'un échec n'est pas constaté sur ce
tableau. Si Claude Code ou Codex échouent, l'option la moins chère est le client ID fixe
détenu par Anthropic (phase 6) et `allow_dynamic_registration` gardé pour les autres.
