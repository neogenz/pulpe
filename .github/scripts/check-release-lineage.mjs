import { execFileSync } from "node:child_process";

const [trustedMain, candidate] = process.argv.slice(2);
const fullSha = /^[0-9a-f]{40}$/;

if (
  process.argv.length !== 4 ||
  !fullSha.test(trustedMain) ||
  !fullSha.test(candidate)
) {
  console.error(
    "usage: node .github/scripts/check-release-lineage.mjs <trusted-main-sha> <candidate-sha>",
  );
  process.exit(1);
}

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

try {
  if (git("cat-file", "-t", trustedMain) !== "commit") {
    throw new Error("trusted main SHA is not a commit");
  }
  if (git("cat-file", "-t", candidate) !== "commit") {
    throw new Error("candidate SHA is not a commit");
  }

  const candidateTree = git("rev-parse", `${candidate}^{tree}`);
  const mergedTree = git(
    "merge-tree",
    "--write-tree",
    "--no-messages",
    candidate,
    trustedMain,
  );

  if (mergedTree !== candidateTree) {
    throw new Error("candidate does not contain the trusted main tree");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
