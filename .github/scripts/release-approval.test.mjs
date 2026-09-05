import assert from "node:assert/strict";
import test from "node:test";

const sha = "a".repeat(40);
const notes = "## v0.49.0\n\nApproved notes.\n";
const pr = {
  head: { ref: "release/v0.49.0", sha, repo: { full_name: "neogenz/pulpe" } },
  base: { ref: "main", repo: { full_name: "neogenz/pulpe" } },
  user: { login: "neogenz" },
  title: "chore(release): v0.49.0",
  body: `<!-- pulpe-release:v0.49.0:${sha} -->\n\n${notes}`,
  merged: true,
  commits: 1,
};

test("native merge preserves approval of the exact commit and notes", async () => {
  const module = await import("./release-approval.mjs").catch(() => ({}));
  assert.equal(
    typeof module.validateApproval,
    "function",
    "release approval validator is implemented",
  );
  assert.equal(
    module.validateApproval(
      pr,
      { productVersion: "0.49.0", githubReleaseNotes: notes },
      "neogenz/pulpe",
    ),
    "0.49.0",
  );
});

for (const [name, change] of [
  [
    "changed commit",
    (p) => {
      p.head.sha = "b".repeat(40);
    },
  ],
  [
    "changed notes",
    (p) => {
      p.body += "Different approval";
    },
  ],
  [
    "fork",
    (p) => {
      p.head.repo.full_name = "other/pulpe";
    },
  ],
  [
    "infrastructure PR",
    (p) => {
      p.head.ref = "feat/automate-release-after-approval";
    },
  ],
  [
    "additional commit",
    (p) => {
      p.commits = 2;
    },
  ],
]) {
  test(`rejects ${name} before production authorization`, async () => {
    const { validateApproval } = await import("./release-approval.mjs");
    const candidate = structuredClone(pr);
    change(candidate);
    assert.throws(() =>
      validateApproval(
        candidate,
        { productVersion: "0.49.0", githubReleaseNotes: notes },
        "neogenz/pulpe",
      ),
    );
  });
}
