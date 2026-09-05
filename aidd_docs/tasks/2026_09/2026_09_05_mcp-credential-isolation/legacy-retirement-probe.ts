import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

// A dedicated local stack with jwt_expiry = 60. Never run against a linked project.
const workdir = process.argv[2];
assert.ok(
  workdir,
  "usage: bun legacy-retirement-probe.ts <short-lived local workdir>",
);
const status = Bun.spawnSync([
  "supabase",
  "status",
  "--workdir",
  workdir,
  "-o",
  "json",
]);
assert.equal(status.exitCode, 0, "local status must succeed");
const local = JSON.parse(status.stdout.toString());
const base = "http://127.0.0.1:56431";
assert.equal(local.API_URL, base, "dedicated retirement stack only");
const callback = "http://localhost:4200/mcp-consent";
let userId: string | undefined;
let clientId: string | undefined;

async function call(
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
      apikey: local.ANON_KEY,
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
async function oauth(body: Record<string, string>) {
  return fetch(`${base}/auth/v1/oauth/token`, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: local.ANON_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
}

try {
  const email = `mcp-retirement-${crypto.randomUUID()}@local.test`;
  const password = randomBytes(32).toString("base64url");
  const owner = await json(
    await call("/auth/v1/admin/users", local.SERVICE_ROLE_KEY, "POST", {
      email,
      password,
      email_confirm: true,
    }),
    "create disposable owner",
  );
  userId = owner.id;
  const firstParty = await json(
    await call("/auth/v1/token?grant_type=password", local.ANON_KEY, "POST", {
      email,
      password,
    }),
    "first-party login",
  );
  const client = await json(
    await call("/auth/v1/admin/oauth/clients", local.SERVICE_ROLE_KEY, "POST", {
      client_name: "Disposable legacy MCP retirement proof",
      client_type: "public",
      token_endpoint_auth_method: "none",
      redirect_uris: [callback],
    }),
    "register disposable legacy client",
  );
  clientId = client.client_id;
  const verifier = randomBytes(32).toString("base64url");
  const authorization = await call(
    `/auth/v1/oauth/authorize?${new URLSearchParams({
      client_id: clientId!,
      response_type: "code",
      redirect_uri: callback,
      code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    })}`,
    local.ANON_KEY,
  );
  assert.equal(authorization.status, 302);
  const id = new URL(authorization.headers.get("location")!).searchParams.get(
    "authorization_id",
  );
  assert.ok(id);
  await json(
    await call(`/auth/v1/oauth/authorizations/${id}`, firstParty.access_token),
    "bind legacy authorization to owner",
  );
  const approved = await json(
    await call(
      `/auth/v1/oauth/authorizations/${id}/consent`,
      firstParty.access_token,
      "POST",
      { action: "approve" },
    ),
    "legacy consent",
  );
  const code = new URL(approved.redirect_url).searchParams.get("code")!;
  const legacy = await json(
    await oauth({
      grant_type: "authorization_code",
      client_id: clientId!,
      code,
      code_verifier: verifier,
      redirect_uri: callback,
    }),
    "legacy token exchange",
  );
  const expiry = JSON.parse(
    Buffer.from(legacy.access_token.split(".")[1], "base64url").toString(),
  ).exp as number;
  assert.ok(
    Number.isFinite(expiry) && expiry * 1000 < Date.now() + 90_000,
    "test stack must issue short-lived JWTs",
  );
  const [template] = await json(
    await call("/rest/v1/template", firstParty.access_token, "POST", {
      user_id: userId,
      name: "Retirement proof",
      is_default: false,
    }),
    "create owner template",
  );
  const tablePath = `/rest/v1/template?id=eq.${template.id}`;
  const probe = async () => {
    const auth = await call("/auth/v1/user", legacy.access_token, "PUT", {
      data: { firstName: "Retirement fixture" },
    });
    const data = await call(tablePath, legacy.access_token, "PATCH", {
      description: "Retirement fixture",
    });
    return [auth.status, data.status];
  };
  assert.deepEqual(await probe(), [200, 200], "legacy direct-write baseline");
  assert.ok(
    (
      await call(
        `/auth/v1/admin/oauth/clients/${clientId}`,
        local.SERVICE_ROLE_KEY,
        "DELETE",
      )
    ).ok,
    "retire exact legacy client",
  );
  const retiredId = clientId;
  clientId = undefined;
  const refresh = await oauth({
    grant_type: "refresh_token",
    client_id: retiredId!,
    refresh_token: legacy.refresh_token,
  });
  assert.ok(
    [400, 401].includes(refresh.status),
    "native OAuth refresh must stop after retirement",
  );
  const alternate = await call(
    "/auth/v1/token?grant_type=refresh_token",
    local.ANON_KEY,
    "POST",
    { refresh_token: legacy.refresh_token },
  );
  assert.ok(
    [400, 401].includes(alternate.status),
    "ordinary refresh endpoint must not revive a legacy OAuth session",
  );
  console.log(
    "Legacy client retired; both refresh routes reject its credentials. Waiting for access-token expiry.",
  );
  const deadline = expiry * 1000 + 90_000;
  let rejected = false;
  while (Date.now() < deadline) {
    const codes = await probe();
    if (codes.every((value) => [401, 403].includes(value))) {
      rejected = true;
      break;
    }
    await Bun.sleep(5000);
  }
  assert.ok(
    rejected,
    "retired legacy bearer must lose Auth and Data API access after expiry",
  );
  const renewed = await json(
    await call(
      "/auth/v1/token?grant_type=refresh_token",
      local.ANON_KEY,
      "POST",
      { refresh_token: firstParty.refresh_token },
    ),
    "ordinary first-party refresh",
  );
  assert.equal((await call("/auth/v1/user", renewed.access_token)).status, 200);
  assert.equal((await call(tablePath, renewed.access_token)).status, 200);
  console.log(
    "Legacy Auth/Data API writes rejected after expiry; ordinary Pulpe login and owner data remain available.",
  );
} finally {
  if (clientId)
    assert.ok(
      (
        await call(
          `/auth/v1/admin/oauth/clients/${clientId}`,
          local.SERVICE_ROLE_KEY,
          "DELETE",
        )
      ).ok,
      "remove disposable client",
    );
  if (userId)
    assert.ok(
      (
        await call(
          `/auth/v1/admin/users/${userId}`,
          local.SERVICE_ROLE_KEY,
          "DELETE",
        )
      ).ok,
      "remove disposable owner",
    );
}
