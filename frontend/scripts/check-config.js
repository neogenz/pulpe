#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script de vérification de configuration pour l'application Pulpe
 * Valide que toutes les variables d'environnement requises sont définies
 * et que leurs valeurs respectent les contraintes de validation
 */

// Charger les variables d'environnement
const envPath = process.env.DOTENV_CONFIG_PATH || ".env";
console.log(`🔍 Vérification de la configuration depuis: ${envPath}`);

if (!fs.existsSync(envPath)) {
  console.error(`❌ Fichier de configuration non trouvé: ${envPath}`);
  console.error(`💡 Copiez .env.example vers ${envPath} et configurez les variables`);
  process.exit(1);
}

require("dotenv").config({ path: envPath });

/**
 * Variables d'environnement requises avec leurs contraintes
 */
const REQUIRED_VARIABLES = {
  PUBLIC_ENVIRONMENT: {
    description: "Environnement d'application",
    validate: (value) => ['development', 'production', 'local', 'test'].includes(value),
    errorMessage: "Doit être 'development', 'production', 'local' ou 'test'"
  },
  PUBLIC_SUPABASE_URL: {
    description: "URL Supabase",
    validate: (value) => {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    },
    errorMessage: "Doit être une URL valide (http:// ou https://)"
  },
  PUBLIC_SUPABASE_ANON_KEY: {
    description: "Clé anonyme Supabase",
    validate: (value) => {
      // Validation JWT basique (header.payload.signature)
      const parts = value.split('.');
      return parts.length === 3 && value.length > 50;
    },
    errorMessage: "Doit être un token JWT valide (3 parties séparées par des points)"
  },
  PUBLIC_BACKEND_API_URL: {
    description: "URL API Backend",
    validate: (value) => {
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') &&
               (value.includes('/api/') || value.includes('localhost'));
      } catch {
        return false;
      }
    },
    errorMessage: "Doit être une URL valide contenant '/api/' ou 'localhost'"
  },
  PUBLIC_POSTHOG_API_KEY: {
    description: "Clé API PostHog",
    validate: (value) => {
      // PostHog API keys: phc_xxxxx avec au moins 10 caractères après le préfixe
      return value.startsWith('phc_') && value.length > 15;
    },
    errorMessage: "Doit commencer par 'phc_' et être suffisamment long"
  },
  PUBLIC_POSTHOG_HOST: {
    description: "Host PostHog",
    validate: (value) => {
      try {
        const url = new URL(value);
        return (url.protocol === 'http:' || url.protocol === 'https:') &&
               (value.includes('posthog.com') || value.includes('posthog.dev') ||
                value.includes('localhost') || value.includes('posthog.in'));
      } catch {
        return false;
      }
    },
    errorMessage: "Doit être une URL PostHog valide"
  },
  PUBLIC_POSTHOG_ENABLED: {
    description: "Activation PostHog",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  },
  PUBLIC_POSTHOG_CAPTURE_PAGEVIEWS: {
    description: "Capture des pages vues",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  },
  PUBLIC_POSTHOG_CAPTURE_PAGELEAVES: {
    description: "Capture des fermetures de pages",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  },
  PUBLIC_POSTHOG_SESSION_RECORDING_ENABLED: {
    description: "Enregistrement de session",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  },
  PUBLIC_POSTHOG_MASK_INPUTS: {
    description: "Masquage des champs",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  },
  PUBLIC_POSTHOG_SAMPLE_RATE: {
    description: "Taux d'échantillonnage",
    validate: (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0 && num <= 1;
    },
    errorMessage: "Doit être un nombre entre 0.0 et 1.0"
  },
  PUBLIC_POSTHOG_DEBUG: {
    description: "Mode debug PostHog",
    validate: (value) => value === 'true' || value === 'false',
    errorMessage: "Doit être 'true' ou 'false'"
  }
};

/**
 * Vérifie une variable d'environnement
 */
function checkVariable(key, config) {
  const value = process.env[key];

  if (value === undefined || value === '') {
    return {
      valid: false,
      error: `❌ ${key}: Variable manquante (${config.description})`
    };
  }

  if (!config.validate(value)) {
    return {
      valid: false,
      error: `❌ ${key}: Valeur invalide - ${config.errorMessage}\n   Valeur actuelle: "${value}"`
    };
  }

  return {
    valid: true,
    message: `✅ ${key}: OK (${config.description})`
  };
}

/**
 * Vérifications supplémentaires de cohérence
 */
function checkConsistency() {
  const errors = [];
  const warnings = [];

  // Vérifier la cohérence PostHog
  const posthogEnabled = process.env.PUBLIC_POSTHOG_ENABLED === 'true';
  const environment = process.env.PUBLIC_ENVIRONMENT;

  if (posthogEnabled && environment === 'test') {
    warnings.push(`⚠️  PostHog activé en environnement 'test' - recommandé: false`);
  }

  if (posthogEnabled && environment === 'development') {
    warnings.push(`⚠️  PostHog activé en développement - vous pouvez le désactiver`);
  }

  // Vérifier l'environnement vs URLs
  if (environment === 'production') {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const backendUrl = process.env.PUBLIC_BACKEND_API_URL;

    if (supabaseUrl && supabaseUrl.includes('localhost')) {
      errors.push(`❌ Environnement 'production' avec URL Supabase locale`);
    }

    if (backendUrl && backendUrl.includes('localhost')) {
      errors.push(`❌ Environnement 'production' avec URL backend locale`);
    }
  }

  // Vérifier la clé PostHog factice en production
  const posthogKey = process.env.PUBLIC_POSTHOG_API_KEY;
  if (environment === 'production' && posthogKey && posthogKey.includes('fake')) {
    errors.push(`❌ Clé PostHog factice en environnement 'production'`);
  }

  return { errors, warnings };
}

/**
 * Fonction principale de vérification
 */
function checkConfiguration() {
  console.log(`\n🔧 Vérification de la configuration Pulpe\n`);

  let allValid = true;
  const results = [];

  // Vérifier chaque variable requise
  for (const [key, config] of Object.entries(REQUIRED_VARIABLES)) {
    const result = checkVariable(key, config);
    results.push(result);

    if (result.valid) {
      console.log(result.message);
    } else {
      console.error(result.error);
      allValid = false;
    }
  }

  // Vérifications de cohérence
  const { errors, warnings } = checkConsistency();

  if (warnings.length > 0) {
    console.log(`\n📋 Avertissements:`);
    warnings.forEach(warning => console.log(warning));
  }

  if (errors.length > 0) {
    console.log(`\n💥 Erreurs de cohérence:`);
    errors.forEach(error => console.error(error));
    allValid = false;
  }

  // Résumé final
  console.log(`\n📊 Résumé:`);
  const validCount = results.filter(r => r.valid).length;
  const totalCount = results.length;

  console.log(`   Variables: ${validCount}/${totalCount} valides`);
  console.log(`   Environnement: ${process.env.PUBLIC_ENVIRONMENT}`);
  console.log(`   PostHog: ${process.env.PUBLIC_POSTHOG_ENABLED === 'true' ? 'activé' : 'désactivé'}`);

  if (allValid) {
    console.log(`\n✅ Configuration valide ! L'application peut démarrer.`);
    return true;
  } else {
    console.log(`\n❌ Configuration invalide. Corrigez les erreurs ci-dessus.`);
    console.log(`\n💡 Conseils:`);
    console.log(`   - Consultez ${envPath} et corrigez les valeurs`);
    console.log(`   - Référez-vous à .env.example pour les formats attendus`);
    console.log(`   - Vérifiez que toutes les variables sont définies`);
    return false;
  }
}

// Exécuter la vérification
if (require.main === module) {
  const isValid = checkConfiguration();
  process.exit(isValid ? 0 : 1);
}

module.exports = { checkConfiguration, checkVariable, REQUIRED_VARIABLES };