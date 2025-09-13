import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ROUTES } from '../routing';

const DEMO_MODE_KEY = 'pulpe-demo-mode';
const DEMO_MODE_INITIALIZED_KEY = 'pulpe-demo-initialized';

@Injectable({
  providedIn: 'root',
})
export class DemoModeService {
  readonly #isDemoMode = signal(false);
  readonly #isInitialized = signal(false);

  readonly isDemoMode = this.#isDemoMode.asReadonly();
  readonly isInitialized = this.#isInitialized.asReadonly();
  readonly demoState = computed(() => ({
    isActive: this.#isDemoMode(),
    isInitialized: this.#isInitialized(),
  }));

  constructor() {
    this.checkDemoModeStatus();
  }

  /**
   * Vérifie si le mode démo est actif au démarrage
   */
  private checkDemoModeStatus(): void {
    const isDemoMode = localStorage.getItem(DEMO_MODE_KEY) === 'true';
    const isInitialized =
      localStorage.getItem(DEMO_MODE_INITIALIZED_KEY) === 'true';

    this.#isDemoMode.set(isDemoMode);
    this.#isInitialized.set(isInitialized);
  }

  /**
   * Active le mode démo
   */
  enableDemoMode(): void {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
    this.#isDemoMode.set(true);
  }

  /**
   * Désactive le mode démo et nettoie toutes les données
   */
  disableDemoMode(): void {
    // Nettoyer toutes les données de démo
    const keysToRemove = [
      DEMO_MODE_KEY,
      DEMO_MODE_INITIALIZED_KEY,
      'pulpe-demo-user',
      'pulpe-demo-session',
      'pulpe-demo-budgets',
      'pulpe-demo-templates',
      'pulpe-demo-template-lines',
      'pulpe-demo-transactions',
      'pulpe-demo-budget-lines',
      'pulpe-current-budget',
    ];

    keysToRemove.forEach((key) => localStorage.removeItem(key));

    this.#isDemoMode.set(false);
    this.#isInitialized.set(false);
  }

  /**
   * Marque le mode démo comme initialisé
   */
  markAsInitialized(): void {
    localStorage.setItem(DEMO_MODE_INITIALIZED_KEY, 'true');
    this.#isInitialized.set(true);
  }

  /**
   * Réinitialise les données de démo (garde le mode actif mais régénère les données)
   */
  resetDemoData(): void {
    if (!this.#isDemoMode()) return;

    // Nettoyer seulement les données, pas l'état du mode
    const dataKeys = [
      'pulpe-demo-user',
      'pulpe-demo-session',
      'pulpe-demo-budgets',
      'pulpe-demo-templates',
      'pulpe-demo-template-lines',
      'pulpe-demo-transactions',
      'pulpe-demo-budget-lines',
      'pulpe-current-budget',
    ];

    dataKeys.forEach((key) => localStorage.removeItem(key));

    localStorage.removeItem(DEMO_MODE_INITIALIZED_KEY);
    this.#isInitialized.set(false);
  }

  /**
   * Vérifie si une clé localStorage appartient au mode démo
   */
  isDemoKey(key: string): boolean {
    return key.startsWith('pulpe-demo-');
  }

  /**
   * Retourne une version "démo" d'une clé localStorage
   */
  getDemoKey(originalKey: string): string {
    if (this.isDemoKey(originalKey)) {
      return originalKey;
    }
    return `pulpe-demo-${originalKey}`;
  }

  /**
   * Helper pour sauvegarder des données en mode démo
   */
  saveDemoData<T>(key: string, data: T): void {
    if (!this.#isDemoMode()) return;

    const demoKey = this.getDemoKey(key);
    localStorage.setItem(demoKey, JSON.stringify(data));
  }

  /**
   * Helper pour récupérer des données en mode démo
   */
  getDemoData<T>(key: string): T | null {
    if (!this.#isDemoMode()) return null;

    const demoKey = this.getDemoKey(key);
    const data = localStorage.getItem(demoKey);

    if (!data) return null;

    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
}
