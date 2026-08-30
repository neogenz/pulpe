#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const DEFAULT_HOST = "https://eu.i.posthog.com";
const LANDING_PROJECT = "pulpe-landing";

export function releasePayload(project, version, commitHash) {
  return {
    project,
    version,
    hash_id: createHash("sha512").update(project).update(version).digest("hex"),
    metadata: { git: { commit_id: commitHash } },
  };
}

async function errorBody(response) {
  const text = await response.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export async function createRelease({
  apiKey,
  envId,
  fetchImpl = fetch,
  host,
  payload,
}) {
  const endpoint = `${host.replace(/\/$/, "")}/api/projects/${envId}/error_tracking/releases/`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return "created";

  const failure = await errorBody(response);
  if (response.status !== 400 || failure.json?.code !== "release_hash_in_use") {
    throw new Error(`${response.status} - ${failure.text}`);
  }

  const existingResponse = await fetchImpl(
    `${endpoint}hash/${payload.hash_id}`,
    {
      headers,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!existingResponse.ok) {
    const existingFailure = await errorBody(existingResponse);
    throw new Error(`${existingResponse.status} - ${existingFailure.text}`);
  }
  const existing = await existingResponse.json();
  if (
    existing.project !== payload.project ||
    existing.version !== payload.version ||
    existing.hash_id !== payload.hash_id
  ) {
    throw new Error("PostHog release hash belongs to another release");
  }
  return "reused";
}

export async function main(env = process.env) {
  const apiKey = env.POSTHOG_PERSONAL_API_KEY;
  const envId = env.POSTHOG_CLI_ENV_ID;
  if (!apiKey || !envId) {
    console.log(
      "⚠️  PostHog credentials not configured for landing releases. Skipping.",
    );
    return;
  }
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
    console.log("⏭️  Non-production Vercel deploy, skipping release creation.");
    return;
  }

  const { version } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (!version) throw new Error("Missing version field in package.json");
  const commitHash =
    env.VERCEL_GIT_COMMIT_SHA ||
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(commitHash))
    throw new Error("Invalid Git commit SHA");

  const payload = releasePayload(LANDING_PROJECT, version, commitHash);
  const result = await createRelease({
    apiKey,
    envId,
    host: env.POSTHOG_HOST || DEFAULT_HOST,
    payload,
  });
  console.log(
    `✅ PostHog release ${payload.project} ${payload.version} ${result}`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`❌ PostHog release failed: ${error.message}`);
    process.exitCode = 1;
  });
}
