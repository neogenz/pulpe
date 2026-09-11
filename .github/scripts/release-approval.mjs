import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validateReleaseManifest } from "./validate-release-manifest.mjs";

export function validateApproval(pr, manifest, repository) {
  const version = pr.head.ref.match(
    /^release\/v([0-9]+\.[0-9]+\.[0-9]+)$/,
  )?.[1];
  validateReleaseManifest(manifest, version);
  assert.match(pr.head.sha, /^[0-9a-f]{40}$/);
  assert.equal(pr.head.repo.full_name, repository);
  assert.equal(pr.base.repo.full_name, repository);
  assert.equal(pr.base.ref, "main");
  assert.ok(
    [repository.split("/")[0], "pulpe-release[bot]"].includes(pr.user.login),
  );
  assert.equal(pr.title, `chore(release): v${version}`);
  assert.equal(pr.merged, true);
  assert.equal(pr.commits, 1);
  assert.equal(
    pr.body.trimEnd(),
    `<!-- pulpe-release:v${version}:${pr.head.sha} -->\n\n${manifest.githubReleaseNotes}`.trimEnd(),
  );
  return version;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [pr, manifest, repository] = process.argv.slice(2);
  console.log(
    validateApproval(
      JSON.parse(readFileSync(pr)),
      JSON.parse(readFileSync(manifest)),
      repository,
    ),
  );
}
