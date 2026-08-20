import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

function items(pages, key) {
  invariant(Array.isArray(pages), `Expected paginated ${key}`);
  return pages.flatMap((page) => page[key] ?? []);
}

function assertRepositorySha({ repository, sha }) {
  invariant(REPOSITORY.test(repository ?? ""), "Invalid repository");
  invariant(SHA.test(sha ?? ""), "Invalid SHA");
}

function assertWorkflowOptions(options) {
  assertRepositorySha(options);
  invariant(
    /^[\w.-]+\.ya?ml$/.test(options.workflow ?? ""),
    "Invalid workflow",
  );
  for (const key of ["event", "branch", "job"]) {
    invariant(options[key], `Missing ${key}`);
  }
  invariant(
    !options.artifactTemplate ||
      ["{sha}", "{run_id}", "{attempt}"].every((token) =>
        options.artifactTemplate.includes(token),
      ),
    "Artifact template must bind SHA, run, and attempt",
  );
}

function sameIdentity(record, options, path) {
  return (
    record.path === path &&
    record.event === options.event &&
    record.head_branch === options.branch &&
    record.head_sha === options.sha
  );
}

export function resolveWorkflowProof(options, api) {
  assertWorkflowOptions(options);
  const path = `.github/workflows/${options.workflow}`;
  const query = new URLSearchParams({
    event: options.event,
    branch: options.branch,
    status: "completed",
    per_page: "100",
  });
  const prefix = `repos/${options.repository}/actions`;
  const runs = items(
    api(`${prefix}/workflows/${options.workflow}/runs?${query}`, true),
    "workflow_runs",
  )
    .filter((run) => sameIdentity(run, options, path))
    .toSorted((a, b) => b.id - a.id);

  const proofs = [];
  for (const run of runs) {
    const base = `${prefix}/runs/${run.id}`;
    const count = api(base).run_attempt;
    invariant(
      Number.isInteger(count) && count > 0,
      "Invalid run attempt count",
    );
    for (let attempt = 1; attempt <= count; attempt += 1) {
      const record = api(`${base}/attempts/${attempt}`);
      invariant(
        sameIdentity(record, options, path) &&
          record.run_attempt === attempt &&
          record.status === "completed",
        "Workflow attempt identity drift",
      );
      if (record.conclusion !== "success") continue;

      const jobs = items(
        api(`${base}/attempts/${attempt}/jobs?per_page=100`, true),
        "jobs",
      ).filter((job) => job.name === options.job);
      invariant(
        jobs.length === 1 &&
          jobs[0].status === "completed" &&
          jobs[0].conclusion === "success",
        "Expected exactly one successful job",
      );
      const proof = { run_id: run.id, attempt, job_id: jobs[0].id };

      if (options.artifactTemplate) {
        const name = options.artifactTemplate
          .replaceAll("{sha}", options.sha)
          .replaceAll("{run_id}", String(run.id))
          .replaceAll("{attempt}", String(attempt));
        const artifacts = items(
          api(
            `${base}/artifacts?name=${encodeURIComponent(name)}&per_page=100`,
            true,
          ),
          "artifacts",
        ).filter((artifact) => artifact.name === name && !artifact.expired);
        invariant(
          artifacts.length === 1,
          "Expected exactly one unexpired artifact",
        );
        Object.assign(proof, {
          artifact_id: artifacts[0].id,
          artifact_name: name,
        });
      }
      proofs.push(proof);
    }
  }
  const selected = proofs.toSorted(
    (a, b) => b.run_id - a.run_id || b.attempt - a.attempt,
  )[0];
  invariant(selected, "No successful immutable workflow proof");
  return selected;
}

export function resolvePublishedMain(options, api) {
  assertRepositorySha(options);
  const prefix = `repos/${options.repository}`;
  const encoded = api(
    `${prefix}/contents/package.json?ref=${options.sha}`,
  ).content;
  const version = JSON.parse(Buffer.from(encoded, "base64")).version;
  invariant(/^\d+\.\d+\.\d+$/.test(version ?? ""), "Invalid published version");

  const tag = `v${version}`;
  const ref = api(`${prefix}/git/ref/tags/${encodeURIComponent(tag)}`);
  invariant(ref.object?.type === "tag", "Tag is not annotated");
  const object = api(`${prefix}/git/tags/${ref.object.sha}`);
  invariant(
    object.tag === tag &&
      object.object?.type === "commit" &&
      object.object.sha === options.sha,
    "Tag does not publish current main",
  );
  const release = api(`${prefix}/releases/tags/${encodeURIComponent(tag)}`);
  invariant(
    release.tag_name === tag &&
      release.target_commitish === options.sha &&
      !release.draft &&
      !release.prerelease,
    "Release does not publish current main",
  );
  return { version, tag };
}

function githubApi(path, paginate = false) {
  const args = ["api", ...(paginate ? ["--paginate", "--slurp"] : []), path];
  return JSON.parse(
    execFileSync("gh", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }),
  );
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
    const result = options.publishedMain
      ? resolvePublishedMain(
          { repository: options.repository, sha: options.publishedMain },
          githubApi,
        )
      : resolveWorkflowProof(options, githubApi);
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
