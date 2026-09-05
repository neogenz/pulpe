import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// Diagnostic reproduction, not a passing security gate. Use a disposable local stack.
const workdir = process.argv[2];
assert.ok(workdir, 'usage: bun oauth-isolation-probe.ts <isolated Supabase workdir>');
const status = Bun.spawnSync(['supabase', 'status', '--workdir', workdir, '-o', 'json']);
assert.equal(status.exitCode, 0, 'local status must succeed');
const config = JSON.parse(status.stdout.toString());
const base = config.API_URL;
assert.ok(['http://127.0.0.1:56421', 'http://localhost:56421'].includes(base), 'isolated loopback instance only');
assert.equal(new URL(base).port, '56421', 'never run this probe on another instance');
const admin = config.SERVICE_ROLE_KEY;
const anon = config.ANON_KEY;
const suffix = randomBytes(8).toString('hex');
const email = `mcp-audit-${suffix}@local.test`;
const password = randomBytes(32).toString('base64url');
const callback = 'http://127.0.0.1:46567/callback';
let userId: string | undefined;
let clientId: string | undefined;

async function request(path: string, token: string, method = 'GET', body?: unknown) {
  return fetch(`${base}${path}`, {
    method, redirect: 'manual',
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(response: Response, operation: string) {
  assert.ok(response.ok, `${operation}: HTTP ${response.status}`);
  return response.json();
}
try {
  const user = await json(await request('/auth/v1/admin/users', admin, 'POST', {
    email, password, email_confirm: true, user_metadata: { firstName: 'First party' },
  }), 'create disposable user');
  userId = user.id;
  const session = await json(await request('/auth/v1/token?grant_type=password', anon, 'POST', { email, password }), 'first-party sign-in');
  const firstParty = session.access_token;
  const client = await json(await request('/auth/v1/oauth/clients/register', anon, 'POST', {
    client_name: 'Pulpe isolated security audit', redirect_uris: [callback],
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none',
  }), 'register OAuth client');
  clientId = client.client_id;
  assert.equal(typeof clientId, 'string');
  const verifier = randomBytes(32).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId!, redirect_uri: callback, response_type: 'code',
    state: suffix, scope: 'openid email profile', code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  });
  const authorization = await request(`/auth/v1/oauth/authorize?${params}`, anon);
  assert.equal(authorization.status, 302, 'authorization must redirect to consent');
  const authorizationId = new URL(authorization.headers.get('location')!).searchParams.get('authorization_id');
  assert.ok(authorizationId);
  await json(await request(`/auth/v1/oauth/authorizations/${authorizationId}`, firstParty), 'read consent details');
  const consent = await json(await request(`/auth/v1/oauth/authorizations/${authorizationId}/consent`, firstParty, 'POST', { action: 'approve' }), 'approve disposable OAuth grant');
  const redirect = new URL(consent.redirect_url);
  assert.equal(redirect.searchParams.get('state'), suffix);
  const exchange = await fetch(`${base}/auth/v1/oauth/token`, {
    method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId!, redirect_uri: callback, code: redirect.searchParams.get('code')!, code_verifier: verifier }),
  });
  const tokens = await json(exchange, 'exchange OAuth code');
  const oauth = tokens.access_token;
  const claims = JSON.parse(Buffer.from(oauth.split('.')[1], 'base64url').toString());
  assert.equal(claims.client_id, clientId);
  assert.equal(claims.sub, userId);
  console.log('Real OAuth token issued:', { role: claims.role, hasClientId: true, subjectMatchesOwner: true });

  const control = await request('/auth/v1/user', firstParty, 'PUT', { data: { firstName: 'First-party control' } });
  assert.equal(control.status, 200);
  const update = await request('/auth/v1/user', oauth, 'PUT', { data: { firstName: 'Changed by OAuth client' } });
  const checked = await json(await request('/auth/v1/user', firstParty), 'verify user metadata');
  console.log('Auth metadata boundary:', { firstPartyStatus: control.status, oauthStatus: update.status, oauthChangePersisted: checked.user_metadata.firstName === 'Changed by OAuth client' });

  const [template] = await json(await request('/rest/v1/template', admin, 'POST', { user_id: userId, name: 'Audit template', description: '', is_default: false }), 'create disposable template');
  const [budget] = await json(await request('/rest/v1/monthly_budget', admin, 'POST', { user_id: userId, template_id: template.id, month: 9, year: 2026, description: 'Original audit budget' }), 'create disposable budget');
  const write = await request(`/rest/v1/monthly_budget?id=eq.${budget.id}`, oauth, 'PATCH', { description: 'Direct OAuth write' });
  console.log('Data API without MCP grant:', { status: write.status, updatedRows: write.ok ? (await write.json()).length : null });
  const revoke = await request(`/auth/v1/user/oauth/grants?client_id=${encodeURIComponent(clientId!)}`, firstParty, 'DELETE');
  assert.ok(revoke.ok, 'revoke disposable OAuth grant');
  const after = await request(`/rest/v1/monthly_budget?id=eq.${budget.id}`, oauth, 'PATCH', { description: 'Direct write after revocation' });
  console.log('Data API after OAuth revocation:', { status: after.status, updatedRows: after.ok ? (await after.json()).length : null });
} finally {
  if (userId) assert.ok((await request(`/auth/v1/admin/users/${userId}`, admin, 'DELETE')).ok, 'remove disposable user');
  if (clientId) assert.ok((await request(`/auth/v1/admin/oauth/clients/${clientId}`, admin, 'DELETE')).ok, 'remove disposable OAuth client');
  console.log('Disposable user and client cleaned up.');
}
