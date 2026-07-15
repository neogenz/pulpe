#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Mode = "projection" | "silent" | "build" | "skip";
type ChangeItem = { title: string; description: string };
type Release = {
  version: string;
  iosVersion?: string;
  date: string;
  githubUrl?: string;
  platforms: string[];
  changes: {
    features: ChangeItem[];
    fixes: ChangeItem[];
    technical: ChangeItem[];
  };
};

const semverPattern = /^\d+\.\d+\.\d+$/;
const modes = new Set<Mode>(["projection", "silent", "build", "skip"]);

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function samePlatforms(a: string[], b: string[]): boolean {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

function validateItems(items: ChangeItem[]): void {
  for (const item of items) {
    invariant(item.title.trim().length > 0, "iOS note title must not be empty");
    invariant(
      item.description.trim().length > 0,
      `iOS note "${item.title}" must have a description`,
    );
  }
}

async function main(): Promise<void> {
  const [productVersion, iosVersion, rawMode] = process.argv.slice(2);
  invariant(
    productVersion && iosVersion && rawMode,
    "Usage: validate-ios-release.ts <product-version> <ios-version> <projection|silent|build|skip>",
  );
  invariant(semverPattern.test(productVersion), "Invalid product SemVer");
  invariant(semverPattern.test(iosVersion), "Invalid iOS SemVer");
  invariant(modes.has(rawMode as Mode), `Invalid release mode: ${rawMode}`);
  const mode = rawMode as Mode;

  const root = process.cwd();
  const projectYml = await readFile(resolve(root, "ios/project.yml"), "utf8");
  const marketingVersion = projectYml.match(
    /MARKETING_VERSION:\s*["']?(\d+\.\d+\.\d+)/,
  )?.[1];
  invariant(
    marketingVersion === iosVersion,
    "ios/project.yml version mismatch",
  );

  const landing = JSON.parse(
    await readFile(resolve(root, "landing/data/releases.json"), "utf8"),
  ) as Release[];
  const landingMatches = landing.filter(
    (release) => release.version === productVersion,
  );

  const releasesModule = await import(
    pathToFileURL(
      resolve(
        root,
        "backend-nest/src/modules/whats-new/domain/releases-data.ts",
      ),
    ).href
  );
  const backendMatches = (releasesModule.RELEASES as Release[]).filter(
    (release) => release.version === productVersion,
  );

  if (mode === "skip") {
    invariant(landingMatches.length === 0, "Skipped release leaked to landing");
    invariant(
      backendMatches.length === 0,
      "Skipped release leaked to iOS feed",
    );
    console.log(`Validated iOS release ${productVersion}: skip`);
    return;
  }

  invariant(landingMatches.length === 1, "Expected one landing release entry");
  const landingRelease = landingMatches[0];
  invariant(isIsoDate(landingRelease.date), "Landing release date is invalid");
  invariant(
    landingRelease.githubUrl ===
      `https://github.com/neogenz/pulpe/releases/tag/v${productVersion}`,
    "Landing GitHub URL mismatch",
  );

  if (mode === "build") {
    invariant(
      landingRelease.iosVersion === undefined,
      "Build-only release must not publish iosVersion",
    );
    invariant(
      backendMatches.length === 0,
      "Build-only release leaked to iOS feed",
    );
    console.log(`Validated iOS release ${productVersion}: build`);
    return;
  }

  invariant(
    landingRelease.platforms.includes("ios"),
    "Landing release misses iOS",
  );
  invariant(
    landingRelease.iosVersion === iosVersion,
    "Landing iOS version mismatch",
  );

  if (mode === "silent") {
    invariant(
      backendMatches.length === 0,
      "Silent release must have no iOS projection",
    );
    console.log(`Validated iOS release ${productVersion}: silent`);
    return;
  }

  invariant(backendMatches.length === 1, "Expected one iOS projection");
  const projection = backendMatches[0];
  invariant(
    projection.iosVersion === iosVersion,
    "Projection iOS version mismatch",
  );
  invariant(
    projection.date === landingRelease.date,
    "Projection date mismatch",
  );
  invariant(
    samePlatforms(projection.platforms, landingRelease.platforms),
    "Projection platforms mismatch",
  );
  invariant(
    projection.changes.technical.length === 0,
    "Projection contains technical notes",
  );

  const items = [...projection.changes.features, ...projection.changes.fixes];
  invariant(
    items.length >= 1 && items.length <= 4,
    "Projection must contain 1–4 notes",
  );
  invariant(
    new Set(items.map((item) => item.title.trim().toLocaleLowerCase("fr")))
      .size === items.length,
    "Projection contains duplicate note titles",
  );
  validateItems(items);
  console.log(
    `Validated iOS release ${productVersion}: projection (${items.length} notes)`,
  );
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`iOS release validation failed: ${message}`);
  process.exit(1);
});
