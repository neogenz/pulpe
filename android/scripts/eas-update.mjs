#!/usr/bin/env node
/**
 * Publishes an over-the-air update with the EXPO_PUBLIC_* values the profile's
 * binaries were built with. `eas update` does not read the `env` of an
 * `eas.json` build profile: run bare, it bundled whatever `.env` sat on the
 * machine, so a production update could point every installed app at a local
 * or preview backend. Values already in the process win over `.env` files.
 *
 * Usage: pnpm update:production --message "…"
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [profileName, ...easArguments] = process.argv.slice(2);
const easConfig = JSON.parse(
  readFileSync(new URL("../eas.json", import.meta.url), "utf8"),
);
const profile = easConfig.build?.[profileName];

if (profile?.channel === undefined || profile.env === undefined) {
  console.error(
    `No build profile "${profileName}" with both a channel and an env in eas.json.`,
  );
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  [
    "dlx",
    "eas-cli@latest",
    "update",
    "--channel",
    profile.channel,
    ...easArguments,
  ],
  { stdio: "inherit", env: { ...process.env, ...profile.env } },
);
process.exit(result.status ?? 1);
