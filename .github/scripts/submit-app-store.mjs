import assert from "node:assert/strict";

export function prepareVersion(versions, target) {
  assert.ok(
    Array.isArray(versions.data),
    "App Store versions must be a complete collection",
  );
  for (const v of versions.data) {
    assert.equal(v.type, "appStoreVersions");
    assert.ok(typeof v.id === "string" && v.id.length > 0);
    assert.match(v.attributes.versionString, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  }
  assert.ok(
    !versions.data.some((v) => v.attributes.versionString === target),
    "App Store version already exists; inspect remote state, do not retry automatically",
  );
  const published = versions.data.filter((v) =>
    ["READY_FOR_SALE", "READY_FOR_DISTRIBUTION"].includes(
      v.attributes.appStoreState,
    ),
  );
  published.sort((a, b) =>
    a.attributes.versionString.localeCompare(b.attributes.versionString, "en", {
      numeric: true,
    }),
  );
  assert.ok(published.length > 0, "No published metadata source");
  const source = published.at(-1).attributes.versionString;
  assert.ok(
    target.localeCompare(source, "en", { numeric: true }) > 0,
    "Target must be newer than published version",
  );
  return source;
}

export function submitVersion(metadata, buildId, asc) {
  const app = "6758464920";
  const source = prepareVersion(
    asc("versions", "list", "--app", app, "--platform", "IOS", "--paginate"),
    metadata.marketingVersion,
  );
  asc(
    "release",
    "stage",
    "--app",
    app,
    "--version",
    metadata.marketingVersion,
    "--build-id",
    buildId,
    "--copy-metadata-from",
    source,
    "--exclude-fields",
    "whatsNew",
    "--confirm",
  );
  const versions = asc(
    "versions",
    "list",
    "--app",
    app,
    "--platform",
    "IOS",
    "--version",
    metadata.marketingVersion,
    "--paginate",
  );
  assert.equal(versions.data.length, 1);
  const id = versions.data[0].id;
  assert.ok(typeof id === "string" && id.length > 0);
  asc(
    "localizations",
    "update",
    "--version",
    id,
    "--locale",
    "fr-FR",
    "--whats-new",
    metadata.whatsNew.frFR,
  );
  const details = asc("review", "details-for-version", "--version-id", id);
  assert.ok(typeof details.data.id === "string" && details.data.id.length > 0);
  asc(
    "review",
    "details-update",
    "--id",
    details.data.id,
    "--notes",
    metadata.reviewNotes,
  );
  asc(
    "versions",
    "update",
    "--version-id",
    id,
    "--release-type",
    "AFTER_APPROVAL",
  );
  const locales = asc("localizations", "list", "--version", id);
  const french = locales.data.filter((l) => l.attributes.locale === "fr-FR");
  assert.equal(french.length, 1);
  assert.equal(french[0].attributes.whatsNew, metadata.whatsNew.frFR);
  assert.equal(
    asc("review", "details-for-version", "--version-id", id).data.attributes
      .notes,
    metadata.reviewNotes,
  );
  const attached = asc(
    "versions",
    "view",
    "--version-id",
    id,
    "--include",
    "build",
  ).data;
  assert.equal(attached.relationships.build.data.id, buildId);
  assert.equal(attached.attributes.releaseType, "AFTER_APPROVAL");
  asc(
    "validate",
    "--app",
    app,
    "--version-id",
    id,
    "--platform",
    "IOS",
    "--strict",
  );
  // One call only. A partial success / eventual-consistency error stops for inspection.
  asc(
    "review",
    "submit",
    "--app",
    app,
    "--version-id",
    id,
    "--build-id",
    buildId,
    "--confirm",
  );
  const final = asc(
    "versions",
    "view",
    "--version-id",
    id,
    "--include",
    "build",
  ).data;
  assert.equal(final.id, id);
  assert.equal(final.attributes.versionString, metadata.marketingVersion);
  assert.equal(final.relationships.build.data.id, buildId);
  assert.equal(final.attributes.releaseType, "AFTER_APPROVAL");
  assert.ok(
    ["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(
      final.attributes.appStoreState,
    ),
    "Submission not yet confirmed; inspect App Store Connect, do not retry",
  );
}

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const asc = (...args) =>
    JSON.parse(
      execFileSync("asc", [...args, "--output", "json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
  const metadata = JSON.parse(readFileSync("app-store-release.json"));
  if (process.argv[2] === "--preflight")
    prepareVersion(
      asc(
        "versions",
        "list",
        "--app",
        "6758464920",
        "--platform",
        "IOS",
        "--paginate",
      ),
      metadata.marketingVersion,
    );
  else submitVersion(metadata, process.argv[2], asc);
}
