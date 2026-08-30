import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createRelease, main, releasePayload } from "./create-release.js";

const commitHash = "a".repeat(40);

test("builds the official stable PostHog release identity", () => {
  const payload = releasePayload("pulpe-landing", "0.47.0", commitHash);
  assert.deepEqual(payload, {
    project: "pulpe-landing",
    version: "0.47.0",
    hash_id: createHash("sha512")
      .update("pulpe-landing")
      .update("0.47.0")
      .digest("hex"),
    metadata: { git: { commit_id: commitHash } },
  });
  assert.notEqual(
    payload.hash_id,
    releasePayload("pulpe-ios", "0.47.0", commitHash).hash_id,
  );
});

test("accepts only the exact release when PostHog reports a reused hash", async () => {
  const payload = releasePayload("pulpe-landing", "0.47.0", commitHash);
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return new Response(JSON.stringify({ code: "release_hash_in_use" }), {
        status: 400,
      });
    }
    return Response.json(payload);
  };

  assert.equal(
    await createRelease({
      apiKey: "phx_test",
      envId: "87621",
      fetchImpl,
      host: "https://test.posthog.com/",
      payload,
    }),
    "reused",
  );
  assert.equal(
    calls[1].url,
    `https://test.posthog.com/api/projects/87621/error_tracking/releases/hash/${payload.hash_id}`,
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);

  await assert.rejects(
    createRelease({
      apiKey: "phx_test",
      envId: "87621",
      host: "https://test.posthog.com",
      payload,
      fetchImpl: async (_url, options) =>
        options?.method === "POST"
          ? new Response(JSON.stringify({ code: "release_hash_in_use" }), {
              status: 400,
            })
          : Response.json({ ...payload, project: "pulpe-ios" }),
    }),
    /belongs to another release/,
  );
});

test("surfaces real API failures while guards remain no-ops", async () => {
  const payload = releasePayload("pulpe-landing", "0.47.0", commitHash);
  await assert.rejects(
    createRelease({
      apiKey: "phx_test",
      envId: "87621",
      host: "https://test.posthog.com",
      payload,
      fetchImpl: async () => new Response("Unauthorized", { status: 401 }),
    }),
    /401 - Unauthorized/,
  );

  await main({ POSTHOG_CLI_ENV_ID: "87621" });
  await main({
    POSTHOG_PERSONAL_API_KEY: "phx_test",
    POSTHOG_CLI_ENV_ID: "87621",
    VERCEL_ENV: "preview",
  });
});

test("main posts the package release with stable identity", async () => {
  const version = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ).version;
  let request;

  await main(
    {
      POSTHOG_PERSONAL_API_KEY: "phx_test",
      POSTHOG_CLI_ENV_ID: "87621",
      POSTHOG_HOST: "https://test.posthog.com/",
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: commitHash,
    },
    async (url, options) => {
      request = { url, options };
      return new Response("{}", { status: 201 });
    },
  );

  assert.equal(
    request.url,
    "https://test.posthog.com/api/projects/87621/error_tracking/releases/",
  );
  assert.deepEqual(
    JSON.parse(request.options.body),
    releasePayload("pulpe-landing", version, commitHash),
  );
});
