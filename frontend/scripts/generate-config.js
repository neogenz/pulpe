#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script pour générer dynamiquement config.json à partir des variables d'environnement
 * Version refactorisée SANS valeurs par défaut magiques
 * Toutes les variables doivent être explicitement définies dans le fichier .env approprié
 */

// Charger les variables d'environnement
const envPath = process.env.DOTENV_CONFIG_PATH || ".env";
console.log(`📁 Loading config from: ${envPath}`);
require("dotenv").config({ path: envPath });

/**
 * Fonction pour obtenir une variable d'environnement requise
 * @param {string} key - Nom de la variable
 * @param {string} description - Description pour l'erreur
 * @returns {string} Valeur de la variable
 * @throws {Error} Si la variable n'est pas définie ou vide
 */
function getRequiredEnv(key, description) {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`❌ Missing required environment variable: ${key} (${description})`);
  }
  return value;
}

/**
 * Fonction pour obtenir une variable booléenne
 * @param {string} key - Nom de la variable
 * @param {boolean} defaultValue - Valeur par défaut si non définie
 * @returns {boolean} Valeur booléenne
 */
function getBooleanEnv(key, defaultValue = false) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === 'true';
}

/**
 * Fonction pour obtenir une variable numérique
 * @param {string} key - Nom de la variable
 * @param {number} defaultValue - Valeur par défaut si non définie
 * @returns {number} Valeur numérique
 */
function getNumberEnv(key, defaultValue = 0) {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return parseFloat(value) || defaultValue;
}

// Configuration SANS valeurs par défaut magiques - toutes les variables sont requises
const config = {
  supabase: {
    url: getRequiredEnv('PUBLIC_SUPABASE_URL', 'Supabase API URL'),
    anonKey: getRequiredEnv('PUBLIC_SUPABASE_ANON_KEY', 'Supabase anonymous key'),
  },
  backend: {
    apiUrl: getRequiredEnv('PUBLIC_BACKEND_API_URL', 'Backend API URL'),
  },
  postHog: {
    apiKey: getRequiredEnv('PUBLIC_POSTHOG_API_KEY', 'PostHog API key'),
    host: getRequiredEnv('PUBLIC_POSTHOG_HOST', 'PostHog host URL'),
    enabled: getBooleanEnv('PUBLIC_POSTHOG_ENABLED'),
    capturePageviews: getBooleanEnv('PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS', true),
    capturePageleaves: getBooleanEnv('PUBLIC_POSTHOG_CAPTURE_PAGELEAVES', true),
    sessionRecording: {
      enabled: getBooleanEnv('PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED'),
      maskInputs: getBooleanEnv('PUBLIC_POSTHOG_MASK_INPUTS', true),
      sampleRate: getNumberEnv('PUBLIC_POSTHOG_SAMPLE_RATE', 0.1),
    },
    debug: getBooleanEnv('PUBLIC_POSTHOG_DEBUG'),
  },
  environment: getRequiredEnv('PUBLIC_ENVIRONMENT', 'Application environment'),
};

const outputPath = path.join(
  __dirname,
  "../projects/webapp/public/config.json",
);

function generateConfig() {
  try {
    console.log("🔧 Génération du fichier config.json...");

    // Créer le répertoire si nécessaire
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Écrire le fichier de configuration
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

    // Affichage des informations de configuration (sans exposer les clés sensibles)
    console.log("✅ config.json généré avec succès");
    console.log(`📍 Fichier: ${outputPath}`);
    console.log(`🌍 Environnement: ${config.environment}`);
    console.log(`🔗 Supabase URL: ${config.supabase.url}`);
    console.log(`🚀 Backend API: ${config.backend.apiUrl}`);
    console.log(`📊 PostHog: ${config.postHog.enabled ? 'activé' : 'désactivé'}`);

    if (config.postHog.enabled) {
      console.log(`   └─ Host: ${config.postHog.host}`);
      console.log(`   └─ Recording: ${config.postHog.sessionRecording.enabled ? 'activé' : 'désactivé'}`);
      console.log(`   └─ Sample rate: ${config.postHog.sessionRecording.sampleRate}`);
    }

  } catch (error) {
    console.error("❌ Erreur lors de la génération du config.json:");
    console.error(`   ${error.message}`);

    // Si c'est une erreur de variable manquante, afficher un conseil
    if (error.message.includes('Missing required environment variable')) {
      console.error("\n💡 Conseil:");
      console.error(`   Vérifiez que le fichier ${envPath} contient toutes les variables requises`);
      console.error("   Ou consultez .env.example pour voir les variables nécessaires");
    }

    process.exit(1);
  }
}

// Exécuter le script
generateConfig();
