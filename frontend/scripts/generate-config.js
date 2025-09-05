#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script pour générer dynamiquement config.json à partir des variables d'environnement
 * Utilisé pour Vercel deployment avec environnements multiples
 */

// Configuration générée à partir des variables d'environnement avec fallbacks
const config = {
  supabase: {
    url: process.env.PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  },
  backend: {
    apiUrl: process.env.PUBLIC_BACKEND_API_URL || 'http://localhost:3000/api/v1'
  },
  environment: process.env.PUBLIC_ENVIRONMENT || 'development'
};

const outputPath = path.join(__dirname, '../projects/webapp/public/config.json');

function generateConfig() {
  try {
    console.log('🔧 Génération du fichier config.json...');
    
    // Créer le répertoire si nécessaire
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Écrire le fichier de configuration
    fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
    
    // Afficher les valeurs utilisées (masquer les clés sensibles)
    const safeConfig = {
      ...config,
      supabase: {
        ...config.supabase,
        anonKey: config.supabase.anonKey ? '***' : 'Non configuré'
      }
    };
    
    console.log('✅ config.json généré avec les variables d\'environnement');
    console.log('📄 Configuration:', JSON.stringify(safeConfig, null, 2));
    console.log(`📍 Fichier généré: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération du config.json:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
generateConfig();