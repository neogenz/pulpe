#!/usr/bin/env tsx

import { config } from "dotenv";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import {
  EnvSchema,
  envToConfig,
  ConfigSchema,
  formatConfigError,
  type EnvironmentVariables
} from "../projects/webapp/src/app/core/config/config.schema";

/**
 * Script pour générer dynamiquement config.json à partir des variables d'environnement
 * Version refactorisée utilisant Zod comme source unique de vérité
 *
 * Utilise EnvSchema pour valider les variables d'environnement
 * Puis ConfigSchema pour valider la configuration finale
 */

// Charger les variables d'environnement
const envPath = process.env.DOTENV_CONFIG_PATH || ".env";
console.log(`📁 Loading config from: ${envPath}`);
config({ path: envPath });

const outputPath = join(
  __dirname,
  "../projects/webapp/public/config.json",
);

function generateConfig(): void {
  try {
    console.log("🔧 Génération du fichier config.json...");

    // Double validation for different purposes:
    // 1. EnvSchema: Validates and transforms env vars (string → types)
    // 2. ConfigSchema: Validates final JSON structure before writing
    // This ensures both input (env vars) and output (config.json) are correct.

    // 1. Valider les variables d'environnement avec EnvSchema
    console.log("🔍 Validation des variables d'environnement...");
    const envResult = EnvSchema.safeParse(process.env);

    if (!envResult.success) {
      console.error("❌ Erreur de validation des variables d'environnement:");
      console.error(formatConfigError(envResult.error));
      console.error("\n💡 Conseil:");
      console.error(`   Vérifiez que le fichier ${envPath} contient toutes les variables requises`);
      console.error("   Ou consultez .env.example pour voir les variables nécessaires");
      process.exit(1);
    }

    const env: EnvironmentVariables = envResult.data;
    console.log("✅ Variables d'environnement validées");

    // 2. Transformer les variables d'environnement en configuration
    console.log("🔄 Transformation vers configuration applicative...");
    const applicationConfig = envToConfig(env);

    // 3. Valider la configuration finale avec ConfigSchema
    // Note: This validation ensures the transformed data structure is correct
    // before writing to config.json (safety check for the transformation logic)
    console.log("🔍 Validation de la configuration finale...");
    const configResult = ConfigSchema.safeParse(applicationConfig);

    if (!configResult.success) {
      console.error("❌ Erreur de validation de la configuration finale:");
      console.error(formatConfigError(configResult.error));
      process.exit(1);
    }

    const validatedConfig = configResult.data;
    console.log("✅ Configuration finale validée");

    // 4. Créer le répertoire si nécessaire
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // 5. Écrire le fichier de configuration
    writeFileSync(outputPath, JSON.stringify(validatedConfig, null, 2));

    // 6. Affichage des informations de configuration (sans exposer les clés sensibles)
    console.log("✅ config.json généré avec succès");
    console.log(`📍 Fichier: ${outputPath}`);
    console.log(`🌍 Environnement: ${validatedConfig.environment}`);
    console.log(`🔗 Supabase URL: ${validatedConfig.supabase.url}`);
    console.log(`🚀 Backend API: ${validatedConfig.backend.apiUrl}`);
    console.log(`📊 PostHog: ${validatedConfig.postHog?.enabled ? 'activé' : 'désactivé'}`);

    if (validatedConfig.postHog?.enabled) {
      console.log(`   └─ Host: ${validatedConfig.postHog.host}`);
      console.log(`   └─ Recording: ${validatedConfig.postHog.sessionRecording?.enabled ? 'activé' : 'désactivé'}`);
      console.log(`   └─ Sample rate: ${validatedConfig.postHog.sessionRecording?.sampleRate}`);
    }

  } catch (error) {
    console.error("❌ Erreur lors de la génération du config.json:");

    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error("   Erreur inconnue:", error);
    }

    console.error("\n💡 Conseil:");
    console.error(`   Vérifiez que le fichier ${envPath} existe et contient toutes les variables requises`);
    console.error("   Consultez .env.example pour voir les variables nécessaires");

    process.exit(1);
  }
}

// Exécuter le script
generateConfig();