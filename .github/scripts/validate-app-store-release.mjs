import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const semver = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const buildNumber = /^[1-9][0-9]{0,17}$/;

const requireText = (value, field) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 4000)
    throw new Error(`${field} must contain 1 to 4000 characters`);
};

export function validateAppStoreRelease(metadata, expected) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    throw new Error("App Store release metadata must be an object");
  const keys = Object.keys(metadata).sort();
  const expectedKeys = [
    "buildNumber",
    "marketingVersion",
    "productVersion",
    "releaseType",
    "reviewNotes",
    "whatsNew",
  ];
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys))
    throw new Error("App Store release metadata must use the exact keys");
  if (
    !metadata.whatsNew ||
    typeof metadata.whatsNew !== "object" ||
    Array.isArray(metadata.whatsNew) ||
    JSON.stringify(Object.keys(metadata.whatsNew).sort()) !==
      JSON.stringify(["frFR"])
  )
    throw new Error("whatsNew must use the exact locale keys");
  if (!semver.test(metadata.productVersion))
    throw new Error("productVersion must use X.Y.Z");
  if (!semver.test(metadata.marketingVersion))
    throw new Error("marketingVersion must use X.Y.Z");
  if (!buildNumber.test(metadata.buildNumber))
    throw new Error("buildNumber must be a positive integer");
  if (metadata.releaseType !== "AFTER_APPROVAL")
    throw new Error("releaseType must be AFTER_APPROVAL");
  requireText(metadata.whatsNew?.frFR, "whatsNew.frFR");
  requireText(metadata.reviewNotes, "reviewNotes");

  for (const field of ["productVersion", "marketingVersion", "buildNumber"])
    if (metadata[field] !== expected[field])
      throw new Error(`${field} does not match the approved release`);

  return metadata;
}

const parseArguments = (args) => {
  const values = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined)
      throw new Error(`Invalid argument: ${flag ?? "missing"}`);
    values[flag.slice(2)] = value;
  }
  return values;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArguments(process.argv.slice(2));
  const metadata = JSON.parse(readFileSync(args.file, "utf8"));
  validateAppStoreRelease(metadata, {
    productVersion: args["product-version"],
    marketingVersion: args["marketing-version"],
    buildNumber: args["build-number"],
  });
  process.stdout.write(`${JSON.stringify(metadata)}\n`);
}
