import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('Running global setup for E2E tests...');

  // Configuration globale pour les tests
  // - Peut être utilisé pour démarrer des services mock
  // - Configurer des bases de données de test
  // - Préparer des données de test

  // Variables d'environnement pour les tests
  process.env['E2E_TESTING'] = 'true';

  console.log('Global setup completed!');
}

export default globalSetup;
