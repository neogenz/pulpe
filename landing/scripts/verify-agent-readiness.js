const NEGOTIATED_VARY = ["accept", "accept-encoding"];
const HTML_VARY = [
  "rsc",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
  "accept-encoding",
];
const RECOVERY_LINKS = ["/sitemap.xml", "/llms.txt", "/support"];

const args = process.argv.slice(2);
const json = args.includes("--json");
const baseArg = args.find((arg) => !arg.startsWith("--"));

if (!baseArg) {
  console.error("Usage: pnpm verify:agents -- <base-url> [--json]");
  process.exit(2);
}

const baseUrl = new URL(baseArg.endsWith("/") ? baseArg : `${baseArg}/`);
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const authHeaders = bypassSecret
  ? {
      "x-vercel-protection-bypass": bypassSecret,
      "x-vercel-set-bypass-cookie": "true",
    }
  : {};

const checks = [
  {
    name: "html-get",
    path: "/",
    accept: "text/html",
    status: 200,
    type: "text/html",
    vary: "html",
    contains: ["<h1"],
    minLength: 500,
  },
  {
    name: "html-head",
    path: "/",
    method: "HEAD",
    accept: "text/html",
    status: 200,
    type: "text/html",
    vary: "html",
    empty: true,
  },
  {
    name: "markdown-get",
    path: "/",
    accept: "text/markdown",
    status: 200,
    type: "text/markdown",
    vary: "negotiated",
    contains: ["# Pulpe"],
    minLength: 500,
  },
  {
    name: "markdown-head",
    path: "/",
    method: "HEAD",
    accept: "text/markdown",
    status: 200,
    type: "text/markdown",
    vary: "negotiated",
    empty: true,
  },
  {
    name: "markdown-quality",
    path: "/",
    accept: "text/html;q=0.2, text/markdown;q=0.8",
    status: 200,
    type: "text/markdown",
    vary: "negotiated",
  },
  {
    name: "html-wildcard",
    path: "/",
    accept: "*/*",
    status: 200,
    type: "text/html",
    vary: "html",
  },
  {
    name: "localized-markdown-406",
    path: "/en",
    accept: "text/markdown",
    status: 406,
    vary: "negotiated",
  },
  {
    name: "unsupported-406",
    path: "/",
    accept: "application/json",
    status: 406,
    vary: "negotiated",
  },
  {
    name: "missing-markdown-get",
    path: "/missing-agent-check",
    accept: "text/markdown",
    status: 404,
    type: "text/markdown",
    vary: "negotiated",
    contains: RECOVERY_LINKS,
  },
  {
    name: "missing-markdown-head",
    path: "/missing-agent-check",
    method: "HEAD",
    accept: "text/markdown",
    status: 404,
    type: "text/markdown",
    vary: "negotiated",
    empty: true,
  },
  {
    name: "missing-html",
    path: "/missing-agent-check",
    accept: "text/html",
    status: 404,
    type: "text/html",
    vary: "html",
    contains: ['name="robots"', "noindex", ...RECOVERY_LINKS],
  },
  {
    name: "missing-unsupported-406",
    path: "/missing-agent-check",
    accept: "application/json",
    status: 406,
    vary: "negotiated",
  },
  {
    name: "robots",
    path: "/robots.txt",
    status: 200,
    type: "text/plain",
    contains: ["User-agent: *", "Sitemap: https://pulpe.app/sitemap.xml"],
  },
];

function varyTokens(value) {
  return value
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function sameTokens(actual, expected) {
  return (
    JSON.stringify(varyTokens(actual)) === JSON.stringify([...expected].sort())
  );
}

const results = [];
const notes = new Set();

for (const check of checks) {
  const errors = [];

  try {
    const response = await fetch(new URL(check.path, baseUrl), {
      method: check.method ?? "GET",
      headers: {
        ...authHeaders,
        ...(check.accept ? { Accept: check.accept } : {}),
      },
      redirect: "follow",
    });
    const body = await response.text();
    const type = response.headers.get("content-type") ?? "";
    const vary = response.headers.get("vary") ?? "";

    if (response.status !== check.status)
      errors.push(`status ${response.status}, expected ${check.status}`);
    if (check.type && !type.toLowerCase().startsWith(check.type))
      errors.push(`content-type ${type || "missing"}, expected ${check.type}`);
    if (check.empty && body !== "")
      errors.push("HEAD response contains a body");
    if (check.minLength && body.length < check.minLength)
      errors.push(`body length ${body.length}, expected >= ${check.minLength}`);
    for (const text of check.contains ?? []) {
      if (!body.includes(text))
        errors.push(`body is missing ${JSON.stringify(text)}`);
    }

    if (check.vary === "negotiated" && !sameTokens(vary, NEGOTIATED_VARY))
      errors.push(
        `vary ${vary || "missing"}, expected Accept, Accept-Encoding`,
      );
    if (check.vary === "html") {
      const tokens = varyTokens(vary);
      for (const token of HTML_VARY) {
        if (!tokens.includes(token)) errors.push(`vary is missing ${token}`);
      }
      if (!tokens.includes("accept")) {
        notes.add(
          "Accepted upstream limitation: final Next.js HTML Vary omits Accept while preserving native RSC tokens.",
        );
      }
    }

    results.push({
      name: check.name,
      method: check.method ?? "GET",
      path: check.path,
      status: response.status,
      type,
      vary,
      outcome: errors.length ? "fail" : "pass",
      errors,
    });
  } catch (error) {
    results.push({
      name: check.name,
      method: check.method ?? "GET",
      path: check.path,
      status: null,
      type: "",
      vary: "",
      outcome: "fail",
      errors: [error instanceof Error ? error.message : String(error)],
    });
  }
}

const report = {
  baseUrl: baseUrl.href,
  ok: results.every(({ outcome }) => outcome === "pass"),
  results,
  notes: [...notes],
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const result of results) {
    console.log(
      `${result.outcome.toUpperCase()} ${result.name} ${result.method} ${result.path} ${result.status ?? "ERROR"}`,
    );
    for (const error of result.errors) console.log(`  ${error}`);
  }
  for (const note of notes) console.log(`NOTE ${note}`);
}

if (!report.ok) process.exitCode = 1;
