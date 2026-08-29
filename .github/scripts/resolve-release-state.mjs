import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPOSITORY = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const BUILD = /^[1-9]\d*$/;

function invariant(value, message) {
  if (!value) throw new Error(message);
}

// The identity IS the workflow run-name: GitHub run lists expose it without
// interpreting logs, and any client (UI button, gh CLI, agent skill) computes
// the same key from the same inputs. Keep these formats in lockstep with the
// `run-name` expressions of the matching workflows.
export function releaseIdentity(options) {
  invariant(REPOSITORY.test(options.repository ?? ""), "Invalid repository");
  if (options.workflow === "release-promotion.yml") {
    invariant(VERSION.test(options.version ?? ""), "Invalid version");
    const mode = options.mode ?? "plan";
    invariant(["plan", "publish"].includes(mode), "Invalid mode");
    return `🚦 ${mode} release/v${options.version}`;
  }
  if (options.workflow === "ios-distribute.yml") {
    invariant(SHA.test(options.sha ?? ""), "Invalid SHA");
    invariant(VERSION.test(options.version ?? ""), "Invalid version");
    invariant(
      ["internal", "release"].includes(options.channel),
      "Invalid channel",
    );
    invariant(BUILD.test(options.build ?? ""), "Invalid build");
    return `📲 iOS ${options.channel} v${options.version} (${options.build}) ${options.sha}`;
  }
  throw new Error("Unsupported workflow");
}

function collectRuns(pages) {
  invariant(
    Array.isArray(pages) && pages.length > 0,
    "Expected paginated workflow runs",
  );
  const runs = pages.flatMap((page) => page.workflow_runs ?? []);
  invariant(
    Number.isInteger(pages[0].total_count) &&
      runs.length === pages[0].total_count,
    "Incomplete workflow run pagination",
  );
  return runs;
}

// Adjacent GitHub resources for a version identity. Structural ambiguity or
// drift fails closed; existence is reported so clients display the resource
// instead of creating a second one.
function resolveVersionResources({ repository, version }, api) {
  const prefix = `repos/${repository}`;
  const branch = `release/v${version}`;
  const refs = api(
    `${prefix}/git/matching-refs/heads/${encodeURIComponent(branch)}`,
  );
  invariant(Array.isArray(refs), "Expected branch refs");
  const exact = refs.filter((ref) => ref.ref === `refs/heads/${branch}`);
  invariant(exact.length <= 1, "Ambiguous release branch refs");
  const branchSha = exact[0]?.object?.sha ?? null;

  const owner = repository.split("/")[0];
  const openPrs = [];
  for (const base of ["main"]) {
    const list = api(
      `${prefix}/pulls?state=open&base=${base}&head=${encodeURIComponent(
        `${owner}:${branch}`,
      )}&per_page=100`,
    );
    invariant(Array.isArray(list), `Expected open ${base} release PRs`);
    invariant(list.length <= 1, `Ambiguous open ${base} release PRs`);
    if (list.length === 1) {
      invariant(
        branchSha !== null && list[0].head?.sha === branchSha,
        "Release PR drifted from its branch",
      );
      openPrs.push({ base, number: list[0].number, url: list[0].html_url });
    }
  }

  const tag = `v${version}`;
  const tagRefs = api(
    `${prefix}/git/matching-refs/tags/${encodeURIComponent(tag)}`,
  );
  invariant(Array.isArray(tagRefs), "Expected tag refs");
  return {
    branch,
    branch_sha: branchSha,
    open_prs: openPrs,
    tag_exists: tagRefs.some((ref) => ref.ref === `refs/tags/${tag}`),
  };
}

function describeRun(run) {
  return {
    run_id: run.id,
    url: run.html_url,
    status: run.status,
    conclusion: run.conclusion ?? null,
  };
}

// Resolves the unique remote state of one release intention. Never mutates:
// clients dispatch only on `absent`, rerun the exact run only on
// `retry-allowed`, and otherwise show the existing resource.
export function resolveReleaseState(options, api) {
  const identity = releaseIdentity(options);
  const prefix = `repos/${options.repository}`;
  const query = new URLSearchParams({
    event: "workflow_dispatch",
    per_page: "100",
  });
  const runs = collectRuns(
    api(`${prefix}/actions/workflows/${options.workflow}/runs?${query}`, true),
  ).filter((run) => run.display_title === identity);

  const active = runs.filter((run) => run.status !== "completed");
  invariant(
    active.length <= 1,
    "Ambiguous release state: duplicate active runs",
  );
  const byNewest = (a, b) => b.id - a.id;
  const succeeded = runs
    .filter((run) => run.status === "completed" && run.conclusion === "success")
    .toSorted(byNewest);
  const failed = runs
    .filter((run) => run.status === "completed" && run.conclusion !== "success")
    .toSorted(byNewest);

  const resources =
    options.workflow === "release-promotion.yml"
      ? resolveVersionResources(options, api)
      : undefined;

  const state = (() => {
    // A published version wins over any run history: the tag is the terminal
    // fact, so neither a leftover failed run nor `--retry` may relaunch it.
    if (resources?.tag_exists) return { state: "published" };
    if (active.length === 1)
      return { state: "active", run: describeRun(active[0]) };
    if (options.retry !== undefined) {
      invariant(
        succeeded.length === 0 &&
          failed.length > 0 &&
          String(failed[0].id) === options.retry,
        "Retry must target the latest terminal run of this identity",
      );
      return { state: "retry-allowed", run: describeRun(failed[0]) };
    }
    if (succeeded.length > 0)
      return { state: "succeeded", run: describeRun(succeeded[0]) };
    if (failed.length > 0)
      return { state: "failed", run: describeRun(failed[0]) };
    return { state: "absent" };
  })();

  return { identity, ...state, ...(resources ? { resources } : {}) };
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
    options[key.slice(2)] = argv[index + 1];
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = resolveReleaseState(
      parseArgs(process.argv.slice(2)),
      githubApi,
    );
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
