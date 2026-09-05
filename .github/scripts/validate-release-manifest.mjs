import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const semver = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export function validateReleaseManifest(value, expectedProductVersion) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("release manifest must be an object");
  }
  const keys = Object.keys(value).sort();
  const expectedKeys = ["githubReleaseNotes", "productVersion"];
  const extra = keys.find((key) => !expectedKeys.includes(key));
  if (extra) throw new Error(`unexpected field: ${extra}`);
  const missing = expectedKeys.find((key) => !keys.includes(key));
  if (missing) throw new Error(`missing field: ${missing}`);

  if (
    typeof value.productVersion !== "string" ||
    !semver.test(value.productVersion) ||
    value.productVersion !== expectedProductVersion
  ) {
    throw new Error(
      "productVersion must match the exact approved X.Y.Z version",
    );
  }
  if (
    typeof value.githubReleaseNotes !== "string" ||
    !value.githubReleaseNotes.startsWith(`## v${value.productVersion}\n`) ||
    value.githubReleaseNotes.length > 20_000
  ) {
    throw new Error(
      "githubReleaseNotes must start with the exact version heading and contain at most 20000 characters",
    );
  }
  return value;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--file", "--product-version"].includes(flag) ||
      value === undefined
    ) {
      throw new Error(`Invalid argument: ${flag ?? "missing"}`);
    }
    values[flag] = value;
  }
  return values;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = parseArguments(process.argv.slice(2));
  const manifest = JSON.parse(readFileSync(args["--file"], "utf8"));
  validateReleaseManifest(manifest, args["--product-version"]);
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
}
