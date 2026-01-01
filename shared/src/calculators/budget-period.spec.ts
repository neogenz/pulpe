/**
 * BUDGET PERIOD TESTS - Tests comportementaux pour le calcul de période budgétaire
 *
 * Valide que le système affiche le bon mois budgétaire en fonction du jour de paie configuré.
 *
 * Règle métier:
 * - Si le jour actuel >= jour de paie → on affiche le mois suivant
 * - Si le jour actuel < jour de paie → on reste dans le mois courant
 */

import { describe, it, expect } from 'vitest';
import {
  getBudgetPeriodForDate,
  compareBudgetPeriods,
  type BudgetPeriod,
} from './budget-period.js';

describe('getBudgetPeriodForDate', () => {
  describe('Comportement calendaire standard (sans jour de paie personnalisé)', () => {
    it('retourne le mois calendaire quand payDayOfMonth est undefined', () => {
      const date = new Date('2025-01-30');
      const result = getBudgetPeriodForDate(date, undefined);

      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('retourne le mois calendaire quand payDayOfMonth est null', () => {
      const date = new Date('2025-01-30');
      const result = getBudgetPeriodForDate(date, null);

      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('retourne le mois calendaire quand payDayOfMonth est 1', () => {
      const date = new Date('2025-01-30');
      const result = getBudgetPeriodForDate(date, 1);

      expect(result).toEqual({ month: 1, year: 2025 });
    });
  });

  describe('Jour de paie personnalisé (scénario principal)', () => {
    /**
     * Scénario utilisateur:
     * "Si mon jour de paie est le 27 et que nous sommes le 30 janvier,
     *  je veux voir le budget de février car ma période février a commencé le 27 janvier"
     */
    it('affiche février quand on est le 30 janvier avec jour de paie au 27', () => {
      const date = new Date('2025-01-30');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche le mois suivant le jour exact du jour de paie', () => {
      const date = new Date('2025-01-27');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche le mois courant la veille du jour de paie', () => {
      const date = new Date('2025-01-26');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('affiche le mois courant le 1er du mois avec jour de paie au 15', () => {
      const date = new Date('2025-03-01');
      const payDayOfMonth = 15;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche le mois suivant après le 15 avec jour de paie au 15', () => {
      const date = new Date('2025-03-20');
      const payDayOfMonth = 15;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 4, year: 2025 });
    });
  });

  describe('Passage à la nouvelle année', () => {
    it('passe à janvier de l année suivante quand on dépasse le jour de paie en décembre', () => {
      const date = new Date('2024-12-28');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('reste en décembre avant le jour de paie', () => {
      const date = new Date('2024-12-26');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 12, year: 2024 });
    });

    it('passe à janvier le jour de paie en décembre', () => {
      const date = new Date('2024-12-27');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      expect(result).toEqual({ month: 1, year: 2025 });
    });
  });

  describe('Jours de paie en fin de mois (> 28)', () => {
    /**
     * Mois courts (février, avril, juin, sept, nov):
     * Si le jour de paie est 31 et le mois n'a que 30 jours,
     * la logique doit quand même fonctionner correctement.
     */
    it('gère correctement un jour de paie au 31 en février (28 jours)', () => {
      // Le 28 février n'atteint pas le jour 31, donc on reste en février
      const date = new Date('2025-02-28');
      const payDayOfMonth = 31;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 28 < 31 donc on reste dans le mois courant (février)
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('gère correctement un jour de paie au 30 le dernier jour d un mois de 31 jours', () => {
      const date = new Date('2025-01-31');
      const payDayOfMonth = 30;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 31 >= 30 donc on passe à février
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('gère correctement un jour de paie au 29 en année bissextile', () => {
      // 2024 est une année bissextile
      const date = new Date('2024-02-29');
      const payDayOfMonth = 29;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 29 >= 29 donc on passe à mars
      expect(result).toEqual({ month: 3, year: 2024 });
    });
  });

  describe('Validation des valeurs limites', () => {
    it('traite payDayOfMonth = 0 comme comportement calendaire (falsy)', () => {
      const date = new Date('2025-01-15');
      const result = getBudgetPeriodForDate(date, 0);

      // 0 est falsy, donc comportement calendaire standard
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('clamp les valeurs de jour de paie > 31 à 31', () => {
      const date = new Date('2025-01-30');
      const result = getBudgetPeriodForDate(date, 50);

      // Avec payDay = 31 (clampé), 30 < 31 donc on reste en janvier
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('arrondit les valeurs décimales', () => {
      const date = new Date('2025-01-15');
      const result = getBudgetPeriodForDate(date, 14.7);

      // 14.7 → 14, et 15 >= 14 donc on passe au mois suivant
      expect(result).toEqual({ month: 2, year: 2025 });
    });
  });
});

describe('compareBudgetPeriods', () => {
  it('retourne 0 pour deux périodes identiques', () => {
    const a: BudgetPeriod = { month: 3, year: 2025 };
    const b: BudgetPeriod = { month: 3, year: 2025 };

    expect(compareBudgetPeriods(a, b)).toBe(0);
  });

  it('retourne -1 quand la première période est antérieure (même année)', () => {
    const a: BudgetPeriod = { month: 1, year: 2025 };
    const b: BudgetPeriod = { month: 3, year: 2025 };

    expect(compareBudgetPeriods(a, b)).toBe(-1);
  });

  it('retourne 1 quand la première période est postérieure (même année)', () => {
    const a: BudgetPeriod = { month: 6, year: 2025 };
    const b: BudgetPeriod = { month: 3, year: 2025 };

    expect(compareBudgetPeriods(a, b)).toBe(1);
  });

  it('retourne -1 quand la première période est une année antérieure', () => {
    const a: BudgetPeriod = { month: 12, year: 2024 };
    const b: BudgetPeriod = { month: 1, year: 2025 };

    expect(compareBudgetPeriods(a, b)).toBe(-1);
  });

  it('retourne 1 quand la première période est une année postérieure', () => {
    const a: BudgetPeriod = { month: 1, year: 2026 };
    const b: BudgetPeriod = { month: 12, year: 2025 };

    expect(compareBudgetPeriods(a, b)).toBe(1);
  });
});
