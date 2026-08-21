import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const BUILD = /^[1-9]\d{0,17}$/;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function exactCollection(response, key) {
  invariant(
    response && typeof response === "object",
    `Expected ${key} response`,
  );
  invariant(Number.isInteger(response.total_count), `Invalid ${key} count`);
  invariant(Array.isArray(response[key]), `Invalid ${key} collection`);
  invariant(response.total_count <= 100, `Too many matching ${key}`);
  invariant(
    response[key].length === response.total_count,
    `Incomplete ${key} collection`,
  );
  return response[key];
}

function assertOptions(options) {
  invariant(REPOSITORY.test(options.repository ?? ""), "Invalid repository");
  invariant(SHA.test(options.sha ?? ""), "Invalid source SHA");
  invariant(
    VERSION.test(options.marketingVersion ?? ""),
    "Invalid marketing version",
  );
  invariant(BUILD.test(options.buildNumber ?? ""), "Invalid build number");
  invariant(
    options.channel === "internal" || options.channel === "release",
    "Invalid channel",
  );
}

function successfulStep(job, name) {
  return (
    job.steps?.filter(
      (step) => step.name === name && step.conclusion === "success",
    ).length === 1
  );
}

function exactProof(proof, options, runId, attempt) {
  return (
    proof?.repository === options.repository &&
    proof.source_sha === options.sha &&
    proof.marketing_version === options.marketingVersion &&
    proof.build_number === options.buildNumber &&
    proof.channel === options.channel &&
    proof.state === "uploading" &&
    proof.run_id === runId &&
    proof.run_attempt === attempt
  );
}

export function resolveDistributionIntent(options, api, readArtifact) {
  assertOptions(options);
  const prefix = [
    "ios-distribution-intent",
    options.marketingVersion,
    options.buildNumber,
    options.sha,
    options.channel,
  ].join("-");
  const apiPrefix = `repos/${options.repository}/actions`;
  const artifacts = exactCollection(
    api(
      `${apiPrefix}/artifacts?name=${encodeURIComponent(prefix)}&per_page=100`,
    ),
    "artifacts",
  );
  invariant(
    artifacts.map((artifact) => artifact.id).every(Number.isInteger) &&
      new Set(artifacts.map((artifact) => artifact.id)).size ===
        artifacts.length,
    "Invalid or duplicate artifact identifiers",
  );

  const proven = artifacts
    .map((artifact) => {
      if (artifact.name !== prefix || artifact.expired) return null;
      const runId = artifact.workflow_run?.id;
      if (!Number.isSafeInteger(runId) || runId <= 0) {
        return null;
      }

      try {
        const proof = readArtifact(artifact, runId);
        const attempt = proof?.run_attempt;
        if (
          !Number.isSafeInteger(attempt) ||
          attempt <= 0 ||
          !exactProof(proof, options, runId, attempt)
        ) {
          return null;
        }
        const run = api(`${apiPrefix}/runs/${runId}/attempts/${attempt}`);
        const expectedBranch =
          options.channel === "internal" ? "preview" : "main";
        if (
          run.id !== runId ||
          run.path !== ".github/workflows/ios-distribute.yml" ||
          run.event !== "workflow_dispatch" ||
          run.head_branch !== expectedBranch ||
          run.repository?.full_name !== options.repository ||
          run.status !== "completed" ||
          run.run_attempt !== attempt
        ) {
          return null;
        }
        const jobs = exactCollection(
          api(
            `${apiPrefix}/runs/${runId}/attempts/${attempt}/jobs?per_page=100`,
          ),
          "jobs",
        ).filter((job) => job.name === "Archive & Upload iOS");
        if (
          jobs.length !== 1 ||
          jobs[0].status !== "completed" ||
          !successfulStep(jobs[0], "Verify exported application identity") ||
          !successfulStep(jobs[0], "Upload iOS distribution intent") ||
          !successfulStep(jobs[0], "Upload to App Store Connect")
        ) {
          return null;
        }
        return { artifact_id: artifact.id, run_id: runId, attempt };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .toSorted((a, b) => b.run_id - a.run_id || b.attempt - a.attempt);

  invariant(proven[0], "No exact prior iOS upload provenance");
  return proven[0];
}

function githubApi(path) {
  const args = ["api", path];
  return JSON.parse(
    execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }),
  );
}

function readGithubArtifact(repository, artifact) {
  const directory = mkdtempSync(join(tmpdir(), "ios-distribution-intent-"));
  try {
    const archive = execFileSync("gh", [
      "api",
      `repos/${repository}/actions/artifacts/${artifact.id}/zip`,
    ]);
    const archivePath = join(directory, "intent.zip");
    writeFileSync(archivePath, archive);
    execFileSync("unzip", ["-q", archivePath, "-d", directory], {
      stdio: "pipe",
    });
    return JSON.parse(
      readFileSync(join(directory, "ios-distribution-intent.json"), "utf8"),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { repository: process.env.GITHUB_REPOSITORY };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    invariant(
      key?.startsWith("--") && argv[index + 1] !== undefined,
      "Arguments must be --key value pairs",
    );
    const name = key
      .slice(2)
      .replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[name] = argv[index + 1];
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = resolveDistributionIntent(options, githubApi, (artifact) =>
      readGithubArtifact(options.repository, artifact),
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
