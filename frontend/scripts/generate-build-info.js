#!/usr/bin/env node

/**
 * Script de génération automatique des informations de build pour Angular 20
 * Génère un fichier TypeScript avec les métadonnées de version, commit et build
 * Compatible avec les environnements CI/CD et local
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Récupère le hash du commit Git courant
 * @returns {string} Hash du commit (7 premiers caractères)
 */
function getGitCommitHash() {
  try {
    const fullHash = execSync("git rev-parse HEAD", {
      encoding: "utf-8",
    }).trim();
    return fullHash.substring(0, 7);
  } catch (error) {
    console.warn('Warning: Unable to get git commit hash, using "dev-build"');
    return "dev-build";
  }
}

/**
 * Récupère le hash complet du commit Git courant
 * @returns {string} Hash complet du commit
 */
function getFullGitCommitHash() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch (error) {
    console.warn(
      'Warning: Unable to get full git commit hash, using "development"',
    );
    return "development";
  }
}

/**
 * Récupère la version depuis package.json
 * @returns {string} Version de l'application
 */
function getVersionFromPackageJson() {
  try {
    const packageJsonPath = path.join(__dirname, "../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "0.0.0-unknown";
  } catch (error) {
    console.warn(
      'Warning: Unable to read version from package.json, using "0.0.0-unknown"',
    );
    return "0.0.0-unknown";
  }
}

/**
 * Génère le contenu du fichier TypeScript avec les informations de build
 * @returns {string} Contenu du fichier TypeScript
 */
function generateBuildInfoContent() {
  const version = getVersionFromPackageJson();
  const commitHash = getFullGitCommitHash();
  const shortCommitHash = getGitCommitHash();
  const buildDate = new Date().toISOString();
  const buildTimestamp = Date.now();

  return `/**
 * Informations de build générées automatiquement
 * ⚠️  Ne pas modifier manuellement - ce fichier est généré par scripts/generate-build-info.js
 * 
 * Généré le: ${buildDate}
 * Commit: ${shortCommitHash}
 * Version: ${version}
 */

export const buildInfo = {
  version: '${version}',
  commitHash: '${commitHash}',
  shortCommitHash: '${shortCommitHash}',
  buildDate: '${buildDate}',
  buildTimestamp: ${buildTimestamp}
} as const;

export type BuildInfo = typeof buildInfo;
`;
}

/**
 * Main function - génère le fichier de build info
 */
function main() {
  console.log("Génération des informations de build...");

  const environmentsDir = path.join(
    __dirname,
    "../projects/webapp/src/environments",
  );

  // Créer le dossier environments s'il n'existe pas
  if (!fs.existsSync(environmentsDir)) {
    fs.mkdirSync(environmentsDir, { recursive: true });
  }

  // Générer le fichier build-info.ts avec les vraies infos
  const buildInfoPath = path.join(environmentsDir, "build-info.ts");
  const buildInfoContent = generateBuildInfoContent();
  fs.writeFileSync(buildInfoPath, buildInfoContent, "utf-8");

  console.log("Fichier de build info généré avec succès :");
  console.log(`   - ${path.relative(process.cwd(), buildInfoPath)}`);
}

// Exécuter le script si appelé directement
if (require.main === module) {
  main();
}

module.exports = {
  generateBuildInfoContent,
  getGitCommitHash,
  getVersionFromPackageJson,
};
