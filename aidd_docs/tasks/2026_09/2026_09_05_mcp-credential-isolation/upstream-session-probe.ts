import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

// Only disposable fixtures, on the dedicated local audit stack. Never print credentials.
const workdir = process.argv[2];
assert.ok(
  workdir,
  "usage: bun upstream-session-probe.ts <isolated Supabase workdir>",
);
const base = "http://127.0.0.1:56421";
await fetch(`${base}/auth/v1/health`, { signal: AbortSignal.timeout(5000) });
const status = Bun.spawnSync([
  "supabase",
  "status",
  "--workdir",
  workdir,
  "-o",
  "json",
]);
assert.equal(status.exitCode, 0, "local status must succeed");
const config = JSON.parse(status.stdout.toString());
assert.equal(config.API_URL, base, "isolated stack only");
const callback = "http://127.0.0.1:46567/mcp/upstream-callback";
const users: string[] = [];
let clientId: string | undefined;

async function request(
  path: string,
  token: string,
  method = "GET",
  body?: unknown,
) {
  return fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: config.ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function json(response: Response, operation: string) {
  assert.ok(response.ok, `${operation}: HTTP ${response.status}`);
  return response.json();
}
async function exchange(body: Record<string, string>) {
  return fetch(`${base}/auth/v1/oauth/token`, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: config.ANON_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
}
try {
  const password = randomBytes(32).toString("base64url");
  const email = `mcp-confidential-${randomBytes(8).toString("hex")}@local.test`;
  const user = await json(
    await request("/auth/v1/admin/users", config.SERVICE_ROLE_KEY, "POST", {
      email,
      password,
      email_confirm: true,
    }),
    "create owner",
  );
  users.push(user.id);
  const firstParty = await json(
    await request(
      "/auth/v1/token?grant_type=password",
      config.ANON_KEY,
      "POST",
      { email, password },
    ),
    "first-party login",
  );
  const client = await json(
    await request(
      "/auth/v1/admin/oauth/clients",
      config.SERVICE_ROLE_KEY,
      "POST",
      {
        client_name: "Pulpe private session proof",
        client_type: "confidential",
        redirect_uris: [callback],
        token_endpoint_auth_method: "client_secret_post",
      },
    ),
    "register confidential upstream",
  );
  clientId = client.client_id;
  assert.equal(typeof clientId, "string");
  assert.equal(typeof client.client_secret, "string");
  for (const round of ["first consent", "existing native grant"]) {
    const verifier = randomBytes(32).toString("base64url");
    const state = randomBytes(32).toString("base64url");
    const authorization = await request(
      `/auth/v1/oauth/authorize?${new URLSearchParams({
        client_id: clientId!,
        response_type: "code",
        redirect_uri: callback,
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      })}`,
      config.ANON_KEY,
    );
    assert.equal(authorization.status, 302, "authorize redirect");
    const id = new URL(authorization.headers.get("location")!).searchParams.get(
      "authorization_id",
    );
    assert.ok(id);
    const details = await json(
      await request(
        `/auth/v1/oauth/authorizations/${id}`,
        firstParty.access_token,
      ),
      "private consent details",
    );
    const approved = details.redirect_url
      ? details
      : await json(
          await request(
            `/auth/v1/oauth/authorizations/${id}/consent`,
            firstParty.access_token,
            "POST",
            { action: "approve" },
          ),
          "approve native grant",
        );
    const redirect = new URL(approved.redirect_url);
    assert.equal(`${redirect.origin}${redirect.pathname}`, callback);
    assert.equal(redirect.searchParams.get("state"), state);
    const payload = {
      grant_type: "authorization_code",
      client_id: clientId!,
      code: redirect.searchParams.get("code")!,
      code_verifier: verifier,
      redirect_uri: callback,
    };
    const unauthorized = await exchange(payload);
    assert.ok(
      [400, 401].includes(unauthorized.status),
      "public exchange must be rejected",
    );
    const tokens = await json(
      await exchange({ ...payload, client_secret: client.client_secret }),
      "confidential exchange",
    );
    const internalUser = await json(
      await request("/auth/v1/user", tokens.access_token),
      "internal auth.getUser compatibility",
    );
    assert.equal(internalUser.id, user.id);
    const [template] = await json(
      await request("/rest/v1/template", tokens.access_token, "POST", {
        user_id: user.id,
        name: "Private owner RLS control",
        description: "",
        is_default: false,
      }),
      "ordinary owner RLS write",
    );
    assert.equal(template.user_id, user.id);
    const refreshed = await json(
      await exchange({
        grant_type: "refresh_token",
        client_id: clientId!,
        client_secret: client.client_secret,
        refresh_token: tokens.refresh_token,
      }),
      "private refresh",
    );
    assert.equal(
      (
        await json(
          await request("/auth/v1/user", refreshed.access_token),
          "refreshed private session",
        )
      ).id,
      user.id,
    );
    console.log(
      `${round}: secret required, owner RLS and private refresh passed`,
    );
  }
  assert.equal(
    (
      await json(
        await request("/auth/v1/user", firstParty.access_token),
        "first-party control",
      )
    ).id,
    user.id,
  );
  console.log(
    "First-party session remains valid. No native credential was sent to an assistant.",
  );
} finally {
  const cleanup = await Promise.all([
    ...users.map((id) =>
      request(`/auth/v1/admin/users/${id}`, config.SERVICE_ROLE_KEY, "DELETE"),
    ),
    ...(clientId
      ? [
          request(
            `/auth/v1/admin/oauth/clients/${clientId}`,
            config.SERVICE_ROLE_KEY,
            "DELETE",
          ),
        ]
      : []),
  ]);
  assert.ok(
    cleanup.every((response) => response.ok),
    "all disposable fixtures must be removed",
  );
}
