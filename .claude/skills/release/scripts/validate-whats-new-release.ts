#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Locale = "fr" | "en" | "de" | "it";
type TranslatedLocale = Exclude<Locale, "fr">;
type IosMode = "none" | "projection" | "silent" | "build" | "skip";
type ChangeItem = { title: string; description: string };
type Changes = {
  features: ChangeItem[];
  fixes: ChangeItem[];
  technical: ChangeItem[];
};
type ReleaseCopy = {
  headline?: string;
  description?: string;
  changes: Changes;
};
type Release = ReleaseCopy & {
  version: string;
  iosVersion?: string;
  date: string;
  githubUrl?: string;
  platforms: string[];
  translations?: Partial<Record<TranslatedLocale, ReleaseCopy>>;
};
type BackendProjection = {
  version: string;
  iosVersion: string;
  date: string;
  platforms: string[];
  changes: Changes;
  translations?: Partial<
    Record<TranslatedLocale, Pick<Changes, "features" | "fixes">>
  >;
};
type SilentRelease = { version: string; reason: string };
type WebRelease = {
  version: string;
  features: Record<Locale, readonly string[]>;
};

const locales: readonly Locale[] = ["fr", "en", "de", "it"];
const translatedLocales: readonly TranslatedLocale[] = ["en", "de", "it"];
const iosModes = new Set<IosMode>([
  "none",
  "projection",
  "silent",
  "build",
  "skip",
]);
const semverPattern = /^\d+\.\d+\.\d+$/;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

function itemKey(item: ChangeItem): string {
  return `${item.title}\u0000${item.description}`;
}

function validateItems(items: readonly ChangeItem[], path: string): void {
  const keys = new Set<string>();
  for (const item of items) {
    invariant(item.title.trim().length > 0, `${path} has an empty title`);
    invariant(
      item.description.trim().length > 0,
      `${path} note "${item.title}" has no description`,
    );
    const key = itemKey(item);
    invariant(!keys.has(key), `${path} contains a duplicate note`);
    keys.add(key);
  }
}

function validateChanges(changes: Changes, path: string): void {
  invariant(changes !== undefined, `${path} is missing`);
  for (const category of ["features", "fixes", "technical"] as const) {
    invariant(
      Array.isArray(changes[category]),
      `${path}.${category} is missing`,
    );
    validateItems(changes[category], `${path}.${category}`);
  }
}

function validateTranslations(release: Release): void {
  invariant(
    release.translations !== undefined,
    `Release ${release.version} is missing localized product copy`,
  );
  invariant(
    sameValues(Object.keys(release.translations), translatedLocales),
    `Release ${release.version} must contain exactly en, de, and it translations`,
  );

  for (const locale of translatedLocales) {
    const copy = release.translations[locale];
    invariant(
      copy !== undefined,
      `Release ${release.version} misses ${locale}`,
    );
    validateChanges(copy.changes, `${release.version}.${locale}.changes`);
    for (const category of ["features", "fixes", "technical"] as const) {
      invariant(
        copy.changes[category].length === release.changes[category].length,
        `Release ${release.version} ${locale}.${category} count differs from French`,
      );
    }
    if (release.headline !== undefined) {
      invariant(
        copy.headline?.trim().length,
        `Release ${release.version} ${locale} headline is missing`,
      );
    }
    if (release.description !== undefined) {
      invariant(
        copy.description?.trim().length,
        `Release ${release.version} ${locale} description is missing`,
      );
    }
  }
}

function validateSubset(
  projected: readonly ChangeItem[],
  approved: readonly ChangeItem[],
  path: string,
): void {
  const approvedKeys = new Set(approved.map(itemKey));
  for (const item of projected) {
    invariant(
      approvedKeys.has(itemKey(item)),
      `${path} note "${item.title}" is absent from the approved landing copy`,
    );
  }
}

function validateProjection(
  projection: BackendProjection,
  landing: Release,
  iosVersion: string,
): void {
  invariant(
    projection.iosVersion === iosVersion,
    "Projection iOS version mismatch",
  );
  invariant(projection.date === landing.date, "Projection date mismatch");
  invariant(
    sameValues(projection.platforms, landing.platforms),
    "Projection platforms mismatch",
  );
  invariant(
    projection.changes.technical.length === 0,
    "Projection contains technical notes",
  );

  const noteCount =
    projection.changes.features.length + projection.changes.fixes.length;
  invariant(
    noteCount >= 1 && noteCount <= 4,
    "Projection must contain 1–4 notes",
  );
  validateSubset(
    projection.changes.features,
    landing.changes.features,
    "projection.fr.features",
  );
  validateSubset(
    projection.changes.fixes,
    landing.changes.fixes,
    "projection.fr.fixes",
  );
  invariant(
    projection.translations !== undefined &&
      sameValues(Object.keys(projection.translations), translatedLocales),
    "Projection must contain exactly en, de, and it translations",
  );

  for (const locale of translatedLocales) {
    const projected = projection.translations[locale];
    const approved = landing.translations?.[locale];
    invariant(projected && approved, `Projection misses ${locale}`);
    invariant(
      projected.features.length === projection.changes.features.length &&
        projected.fixes.length === projection.changes.fixes.length,
      `Projection ${locale} category counts differ from French`,
    );
    validateSubset(
      projected.features,
      approved.changes.features,
      `projection.${locale}.features`,
    );
    validateSubset(
      projected.fixes,
      approved.changes.fixes,
      `projection.${locale}.fixes`,
    );
  }
}

function validateSilentRegistry(
  silentReleases: readonly SilentRelease[],
  projections: readonly BackendProjection[],
): void {
  const versions = new Set<string>();
  for (const release of silentReleases) {
    invariant(
      semverPattern.test(release.version),
      `Invalid silent iOS SemVer: ${release.version}`,
    );
    invariant(
      release.reason.trim().length > 0,
      `Silent iOS release ${release.version} has no reason`,
    );
    invariant(
      !versions.has(release.version),
      `Duplicate silent iOS release: ${release.version}`,
    );
    invariant(
      !projections.some(({ version }) => version === release.version),
      `iOS release ${release.version} is both projected and silent`,
    );
    versions.add(release.version);
  }
}

function validateWebDecision(
  productVersion: string,
  landing: Release | undefined,
  latest: WebRelease,
  skipped: readonly SilentRelease[],
): void {
  const skips = skipped.filter(({ version }) => version === productVersion);
  const isToast = latest.version === productVersion;
  invariant(
    Number(isToast) + skips.length === 1,
    `Webapp release ${productVersion} must have exactly one toast or silent entry`,
  );
  invariant(
    !isToast || landing?.platforms.includes("web"),
    `Webapp toast ${productVersion} has no web scope`,
  );

  const skippedVersions = new Set<string>();
  for (const release of skipped) {
    invariant(
      semverPattern.test(release.version),
      `Invalid silent web SemVer: ${release.version}`,
    );
    invariant(
      release.reason.trim().length > 0,
      `Silent web release ${release.version} has no reason`,
    );
    invariant(
      !skippedVersions.has(release.version),
      `Duplicate silent web release: ${release.version}`,
    );
    skippedVersions.add(release.version);
  }

  invariant(semverPattern.test(latest.version), "Invalid webapp toast SemVer");
  invariant(
    sameValues(Object.keys(latest.features), locales),
    "Webapp toast must contain exactly fr, en, de, and it",
  );
  const counts = locales.map((locale) => {
    const features = latest.features[locale];
    invariant(
      features.every((feature) => feature.trim().length > 0),
      `Webapp toast ${locale} contains an empty item`,
    );
    return features.length;
  });
  invariant(
    counts[0] >= 1 && counts[0] <= 4,
    "Webapp toast must contain 1–4 items",
  );
  invariant(new Set(counts).size === 1, "Webapp toast locale counts differ");
}

async function main(): Promise<void> {
  const [productVersion, rawMode, iosVersion] = process.argv.slice(2);
  invariant(
    productVersion && rawMode,
    "Usage: validate-whats-new-release.ts <product-version> <none|projection|silent|build|skip> [ios-version]",
  );
  invariant(semverPattern.test(productVersion), "Invalid product SemVer");
  invariant(iosModes.has(rawMode as IosMode), `Invalid iOS mode: ${rawMode}`);
  const mode = rawMode as IosMode;
  if (mode === "projection" || mode === "silent" || mode === "build") {
    invariant(
      iosVersion && semverPattern.test(iosVersion),
      "A valid iOS SemVer is required",
    );
  }

  const root = process.cwd();
  const productPackage = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  ) as { version?: string };
  invariant(
    productPackage.version === productVersion,
    "Root product version mismatch",
  );

  const landing = JSON.parse(
    await readFile(resolve(root, "landing/data/releases.json"), "utf8"),
  ) as Release[];
  const landingMatches = landing.filter(
    ({ version }) => version === productVersion,
  );
  const duplicateVersions = landing.map(({ version }) => version);
  invariant(
    new Set(duplicateVersions).size === duplicateVersions.length,
    "Landing contains duplicate release versions",
  );
  for (const release of landing) {
    invariant(
      isIsoDate(release.date),
      `Release ${release.version} has an invalid date`,
    );
    validateChanges(release.changes, `${release.version}.fr.changes`);
    if (release.translations !== undefined) validateTranslations(release);
  }

  const backendModule = await import(
    pathToFileURL(
      resolve(
        root,
        "backend-nest/src/modules/whats-new/domain/releases-data.ts",
      ),
    ).href
  );
  const projections = backendModule.RELEASES as BackendProjection[];
  const silentIos = backendModule.SILENT_IOS_RELEASES as SilentRelease[];
  validateSilentRegistry(silentIos, projections);

  const webModule = await import(
    pathToFileURL(
      resolve(
        root,
        "frontend/projects/webapp/src/app/layout/whats-new/whats-new-releases.ts",
      ),
    ).href
  );
  const latestWeb = webModule.LATEST_RELEASE as WebRelease;
  const skippedWeb = webModule.SKIPPED_RELEASES as SilentRelease[];

  if (mode === "skip") {
    invariant(landingMatches.length === 0, "Skipped release leaked to landing");
    invariant(
      projections.every(({ version }) => version !== productVersion),
      "Skipped release leaked to iOS feed",
    );
    invariant(
      silentIos.every(({ version }) => version !== productVersion),
      "Skipped release leaked to iOS silent registry",
    );
    validateWebDecision(productVersion, undefined, latestWeb, skippedWeb);
    console.log(`Validated What's New release ${productVersion}: skip`);
    return;
  }

  invariant(landingMatches.length === 1, "Expected one landing release entry");
  const landingRelease = landingMatches[0];
  invariant(
    landingRelease.githubUrl ===
      `https://github.com/neogenz/pulpe/releases/tag/v${productVersion}`,
    "Landing GitHub URL mismatch",
  );
  validateTranslations(landingRelease);
  validateWebDecision(productVersion, landingRelease, latestWeb, skippedWeb);

  const projectionMatches = projections.filter(
    ({ version }) => version === productVersion,
  );
  const silentMatches = silentIos.filter(
    ({ version }) => version === productVersion,
  );
  if (mode === "none" || mode === "build") {
    invariant(
      landingRelease.iosVersion === undefined,
      `${mode} release must not publish iosVersion`,
    );
    invariant(
      projectionMatches.length === 0,
      `${mode} release leaked to iOS feed`,
    );
    invariant(
      silentMatches.length === 0,
      `${mode} release leaked to iOS silent registry`,
    );
    if (mode === "build") {
      const projectYml = await readFile(
        resolve(root, "ios/project.yml"),
        "utf8",
      );
      const marketingVersion = projectYml.match(
        /MARKETING_VERSION:\s*["']?(\d+\.\d+\.\d+)/,
      )?.[1];
      invariant(
        marketingVersion === iosVersion,
        "Build-only release changed the iOS marketing version",
      );
    }
  } else {
    invariant(
      landingRelease.platforms.includes("ios"),
      "Landing release misses iOS scope",
    );
    invariant(
      landingRelease.iosVersion === iosVersion,
      "Landing iOS version mismatch",
    );
    const projectYml = await readFile(resolve(root, "ios/project.yml"), "utf8");
    const marketingVersion = projectYml.match(
      /MARKETING_VERSION:\s*["']?(\d+\.\d+\.\d+)/,
    )?.[1];
    invariant(
      marketingVersion === iosVersion,
      "ios/project.yml version mismatch",
    );

    if (mode === "silent") {
      invariant(
        projectionMatches.length === 0,
        "Silent release must have no iOS projection",
      );
      invariant(
        silentMatches.length === 1,
        "Silent release must have one motivated entry",
      );
    } else {
      invariant(projectionMatches.length === 1, "Expected one iOS projection");
      invariant(
        silentMatches.length === 0,
        "Projected release leaked to iOS silent registry",
      );
      validateProjection(projectionMatches[0], landingRelease, iosVersion);
    }
  }

  console.log(`Validated What's New release ${productVersion}: ${mode}`);
}

await main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`What's New release validation failed: ${message}`);
  process.exit(1);
});
