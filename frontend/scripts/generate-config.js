#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script pour générer dynamiquement config.json à partir des variables d'environnement Vercel
 * Cible : branches de preview pour changer l'URL du backend
 */

const PRODUCTION_CONFIG_PATH = path.join(
  __dirname,
  "../projects/webapp/public/environments/production/config.json",
);
const OUTPUT_CONFIG_PATH = path.join(
  __dirname,
  "../projects/webapp/public/config.json",
);

function generateConfig() {
  try {
    console.log("🔧 Génération du fichier config.json...");

    // Lire le config de production comme base
    if (!fs.existsSync(PRODUCTION_CONFIG_PATH)) {
      throw new Error(
        `Fichier de config de production introuvable: ${PRODUCTION_CONFIG_PATH}`,
      );
    }

    let productionConfig;
    try {
      productionConfig = JSON.parse(
        fs.readFileSync(PRODUCTION_CONFIG_PATH, "utf8"),
      );
    } catch (e) {
      throw new Error(
        `Fichier de config de production invalide (JSON) : ${e.message}`,
      );
    }
    console.log("✅ Config de production chargée");

    // Appliquer les variables d'environnement si elles existent
    let config = { ...productionConfig };
    let hasChanges = false;

    // Remplacer l'URL du backend si VITE_BACKEND_API_URL est définie
    if (process.env.VITE_BACKEND_API_URL) {
      config.backend = {
        ...config.backend,
        apiUrl: process.env.VITE_BACKEND_API_URL,
      };
      console.log(
        `🔄 URL du backend remplacée: ${process.env.VITE_BACKEND_API_URL}`,
      );
      hasChanges = true;
    }

    // Créer le répertoire de sortie si nécessaire
    const outputDir = path.dirname(OUTPUT_CONFIG_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Écrire le fichier final
    fs.writeFileSync(OUTPUT_CONFIG_PATH, JSON.stringify(config, null, 2));

    if (hasChanges) {
      console.log("✅ config.json généré avec les variables d'environnement");
    } else {
      console.log(
        "✅ config.json copié depuis la config de production (aucune variable d'environnement)",
      );
    }

    console.log(`📄 Fichier généré: ${OUTPUT_CONFIG_PATH}`);
  } catch (error) {
    console.error(
      "❌ Erreur lors de la génération du config.json:",
      error.message,
    );
    process.exit(1);
  }
}

// Exécuter le script
generateConfig();
