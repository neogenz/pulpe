import 'reflect-metadata';

// ============================================================================
// TEST ENVIRONMENT VARIABLES
// ============================================================================
// Set required environment variables before any NestJS modules are imported.
// ConfigModule.forRoot() validates these at import time, so they must be set
// before the test files import their modules.

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.TURNSTILE_SECRET_KEY =
  process.env.TURNSTILE_SECRET_KEY || 'test-turnstile-secret';
process.env.ENCRYPTION_MASTER_KEY =
  process.env.ENCRYPTION_MASTER_KEY || 'ab'.repeat(32);
process.env.MCP_WRAPPING_KEY = process.env.MCP_WRAPPING_KEY || 'cd'.repeat(32);

// ============================================================================
// TEST LOG SILENCING SYSTEM
// ============================================================================

/**
 * Système de suppression des logs pour les tests
 * Permet d'avoir une sortie de test propre en masquant les logs de bruit
 * tout en gardant les messages importants
 */
class TestLogSilencer {
  private readonly originalMethods = {
    consoleError: console.error,
    consoleWarn: console.warn,
    consoleLog: console.log,
    stderrWrite: process.stderr.write,
  };

  private readonly isDebugMode = process.env.DEBUG_TESTS === 'true';
  private isActive = false;

  // Messages qui doivent passer même en mode silencieux
  private readonly allowedLogPatterns = [
    /🧪 Test environment/,
    /🚀 Starting load test/,
  ];

  // Messages à supprimer pendant les tests
  private readonly silencedPatterns = [
    // Warnings système
    /ExperimentalWarning/i,
    /DeprecationWarning/i,
    /UnhandledPromiseRejectionWarning/i,

    // Logs NestJS attendus durant les tests d'erreur
    /\[Nest\].*ERROR.*\[.*Guard\]/,
    /\[Nest\].*ERROR.*\[.*Service\]/,
    /\[Nest\].*ERROR.*\[.*Controller\]/,

    // Erreurs simulées dans les tests
    /Error: Network error/,
    /Error: Database.*error/,
    /Error: Unexpected.*error/,
    /Erreur.*:/,
    /Object\(1\).*{/,

    // Stack traces de test
    /at <anonymous>/,
    /at \w+/,
  ];

  /**
   * Active la suppression des logs
   */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.overrideConsoleMethods();
    this.overrideStderrWrite();
  }

  /**
   * Désactive la suppression et restaure les méthodes originales
   */
  deactivate(): void {
    if (!this.isActive) return;

    console.error = this.originalMethods.consoleError;
    console.warn = this.originalMethods.consoleWarn;
    console.log = this.originalMethods.consoleLog;
    process.stderr.write = this.originalMethods.stderrWrite;

    this.isActive = false;
  }

  /**
   * Vérifie si un message doit être supprimé
   */
  private shouldSilenceMessage(message: string): boolean {
    if (this.isDebugMode) return false;

    return this.silencedPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Vérifie si un message doit passer même en mode silencieux
   */
  private shouldAllowMessage(message: string): boolean {
    return this.allowedLogPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Override des méthodes console
   */
  private overrideConsoleMethods(): void {
    console.error = (message: unknown, ...args: unknown[]) => {
      if (this.isDebugMode || !this.shouldSilenceMessage(String(message))) {
        this.originalMethods.consoleError(message, ...args);
      }
    };

    console.warn = (message: unknown, ...args: unknown[]) => {
      if (this.isDebugMode) {
        this.originalMethods.consoleWarn(message, ...args);
      }
      // En mode normal, on supprime tous les warnings
    };

    console.log = (message: unknown, ...args: unknown[]) => {
      const messageStr = String(message);
      if (this.isDebugMode || this.shouldAllowMessage(messageStr)) {
        this.originalMethods.consoleLog(message, ...args);
      }
    };
  }

  /**
   * Override de process.stderr.write pour capturer les logs NestJS/Pino
   */
  private overrideStderrWrite(): void {
    process.stderr.write = (chunk: unknown, ...args: unknown[]): boolean => {
      if (this.isDebugMode || !this.shouldSilenceMessage(String(chunk))) {
        return this.originalMethods.stderrWrite.call(
          process.stderr,
          String(chunk),
          ...(args as any[]),
        );
      }

      return true; // Simuler l'écriture réussie
    };
  }
}

// ============================================================================
// INITIALISATION DU SYSTÈME DE TEST
// ============================================================================

// Créer et activer le silenceur de logs
const logSilencer = new TestLogSilencer();

// Message de bienvenue
console.log('🧪 Test environment initialized with Bun');

// Activer la suppression des logs en mode test
if (process.env.NODE_ENV === 'test') {
  logSilencer.activate();
}

// Fonction de nettoyage pour restaurer les méthodes originales si nécessaire
export const restoreConsole = (): void => {
  logSilencer.deactivate();
};

// Exporter le silenceur pour usage avancé si nécessaire
export const testLogSilencer = logSilencer;
