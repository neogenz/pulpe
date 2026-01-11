/**
 * BUDGET PERIOD TESTS - Tests comportementaux pour le calcul de période budgétaire
 *
 * Valide que le système affiche le bon mois budgétaire en fonction du jour de paie
 * et de la règle "quinzaine".
 *
 * RÈGLE QUINZAINE:
 * - payDay <= 15 (1ère quinzaine): budget nommé d'après le mois de DÉBUT
 *   → Budget "Mars" couvre: 5 mars - 4 avril
 * - payDay > 15 (2ème quinzaine): budget nommé d'après le mois de FIN
 *   → Budget "Mars" couvre: 27 fév - 26 mars
 */

import { describe, it, expect } from 'vitest';
import {
  getBudgetPeriodForDate,
  getBudgetPeriodDates,
  formatBudgetPeriod,
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

  describe('1ère quinzaine (payDay <= 15) - budget nommé d après le mois de début', () => {
    /**
     * Scénario: payDay = 5
     * Budget "Mars" couvre: 5 mars - 4 avril
     */
    it('affiche mars quand on est le 6 mars avec jour de paie au 5', () => {
      const date = new Date('2025-03-06');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 6 >= 5 → période mars (5 mars - 4 avril)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche le mois courant le jour exact du jour de paie', () => {
      const date = new Date('2025-03-05');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 5 >= 5 → période mars (commence le 5 mars)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche le mois précédent la veille du jour de paie', () => {
      const date = new Date('2025-03-04');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 4 < 5 → période février (5 fév - 4 mars)
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche février quand on est le 1er mars avec jour de paie au 15', () => {
      const date = new Date('2025-03-01');
      const payDayOfMonth = 15;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 1 < 15 → période février (15 fév - 14 mars)
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche mars quand on est le 20 mars avec jour de paie au 15', () => {
      const date = new Date('2025-03-20');
      const payDayOfMonth = 15;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 20 >= 15 → période mars (15 mars - 14 avril)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche janvier quand on est le 6 janvier avec jour de paie au 3', () => {
      const date = new Date('2025-01-06');
      const payDayOfMonth = 3;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 6 >= 3 → période janvier (3 jan - 2 fév)
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('affiche décembre quand on est le 2 janvier avec jour de paie au 3', () => {
      const date = new Date('2025-01-02');
      const payDayOfMonth = 3;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 2 < 3 → période décembre (3 déc - 2 jan)
      expect(result).toEqual({ month: 12, year: 2024 });
    });
  });

  describe('2ème quinzaine (payDay > 15) - budget nommé d après le mois de fin', () => {
    /**
     * Scénario: payDay = 27
     * Budget "Mars" couvre: 27 fév - 26 mars
     * Budget "Février" couvre: 27 jan - 26 fév
     */
    it('affiche février quand on est le 28 janvier avec jour de paie au 27', () => {
      const date = new Date('2025-01-28');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 28 >= 27, payDay > 15 → +1 mois → période février (27 jan - 26 fév)
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche février le jour exact du jour de paie au 27 janvier', () => {
      const date = new Date('2025-01-27');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 27 >= 27, payDay > 15 → +1 mois → période février (commence le 27 jan)
      expect(result).toEqual({ month: 2, year: 2025 });
    });

    it('affiche janvier la veille du jour de paie au 26 janvier', () => {
      const date = new Date('2025-01-26');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 26 < 27 → décembre + payDay > 15 → +1 mois → janvier (27 déc - 26 jan)
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('affiche mars quand on est le 1er mars avec jour de paie au 27', () => {
      const date = new Date('2025-03-01');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 1 < 27 → février + payDay > 15 → +1 mois → mars (27 fév - 26 mars)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche mars quand on est le 26 mars avec jour de paie au 27', () => {
      const date = new Date('2025-03-26');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 26 < 27 → février + payDay > 15 → +1 mois → mars (27 fév - 26 mars)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche avril quand on est le 27 mars avec jour de paie au 27', () => {
      const date = new Date('2025-03-27');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 27 >= 27 → mars + payDay > 15 → +1 mois → avril (27 mars - 26 avril)
      expect(result).toEqual({ month: 4, year: 2025 });
    });

    /**
     * Scénario: payDay = 20
     * Budget "Mars" couvre: 20 fév - 19 mars
     */
    it('affiche mars quand on est le 19 mars avec jour de paie au 20', () => {
      const date = new Date('2025-03-19');
      const payDayOfMonth = 20;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 19 < 20 → février + payDay > 15 → +1 mois → mars (20 fév - 19 mars)
      expect(result).toEqual({ month: 3, year: 2025 });
    });

    it('affiche avril quand on est le 20 mars avec jour de paie au 20', () => {
      const date = new Date('2025-03-20');
      const payDayOfMonth = 20;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 20 >= 20 → mars + payDay > 15 → +1 mois → avril (20 mars - 19 avril)
      expect(result).toEqual({ month: 4, year: 2025 });
    });
  });

  describe('Passage à la nouvelle année avec 2ème quinzaine', () => {
    it('affiche janvier 2025 quand on est le 28 décembre 2024 avec jour de paie au 27', () => {
      const date = new Date('2024-12-28');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 28 >= 27 → décembre + payDay > 15 → +1 mois → janvier 2025
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('affiche décembre 2024 quand on est le 26 décembre 2024 avec jour de paie au 27', () => {
      const date = new Date('2024-12-26');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 26 < 27 → novembre + payDay > 15 → +1 mois → décembre
      expect(result).toEqual({ month: 12, year: 2024 });
    });

    it('affiche janvier 2025 quand on est le 5 janvier 2025 avec jour de paie au 27', () => {
      const date = new Date('2025-01-05');
      const payDayOfMonth = 27;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 5 < 27 → décembre 2024 + payDay > 15 → +1 mois → janvier 2025
      expect(result).toEqual({ month: 1, year: 2025 });
    });
  });

  describe('Passage à la nouvelle année avec 1ère quinzaine', () => {
    it('reste en décembre quand on dépasse le jour de paie en décembre', () => {
      const date = new Date('2024-12-06');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 6 >= 5 → décembre (5 déc - 4 jan)
      expect(result).toEqual({ month: 12, year: 2024 });
    });

    it('affiche novembre avant le jour de paie en décembre', () => {
      const date = new Date('2024-12-04');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 4 < 5 → novembre (5 nov - 4 déc)
      expect(result).toEqual({ month: 11, year: 2024 });
    });

    it('passe à l année précédente quand on est avant le jour de paie en janvier', () => {
      const date = new Date('2025-01-04');
      const payDayOfMonth = 5;

      const result = getBudgetPeriodForDate(date, payDayOfMonth);

      // 4 < 5 → décembre 2024 (5 déc - 4 jan)
      expect(result).toEqual({ month: 12, year: 2024 });
    });
  });

  describe('Validation des valeurs limites', () => {
    it('traite payDayOfMonth = 0 comme comportement calendaire (falsy)', () => {
      const date = new Date('2025-01-15');
      const result = getBudgetPeriodForDate(date, 0);

      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('clamp les valeurs de jour de paie > 31 à 31', () => {
      const date = new Date('2025-01-30');
      const result = getBudgetPeriodForDate(date, 50);

      // payDay clampé à 31 > 15, 30 < 31 → décembre + 1 → janvier
      expect(result).toEqual({ month: 1, year: 2025 });
    });

    it('arrondit les valeurs décimales', () => {
      const date = new Date('2025-01-15');
      const result = getBudgetPeriodForDate(date, 14.7);

      // 14.7 → 14 (floor), 15 >= 14, payDay <= 15 → janvier
      expect(result).toEqual({ month: 1, year: 2025 });
    });
  });
});

describe('getBudgetPeriodDates', () => {
  describe('Comportement calendaire (payDay = 1)', () => {
    it('retourne le mois calendaire complet', () => {
      const result = getBudgetPeriodDates(3, 2026, 1);

      expect(result.startDate).toEqual(new Date(2026, 2, 1)); // 1 mars
      expect(result.endDate).toEqual(new Date(2026, 2, 31)); // 31 mars
    });

    it('gère février correctement', () => {
      const result = getBudgetPeriodDates(2, 2026, 1);

      expect(result.startDate).toEqual(new Date(2026, 1, 1)); // 1 fév
      expect(result.endDate).toEqual(new Date(2026, 1, 28)); // 28 fév (non bissextile)
    });

    it('gère février en année bissextile', () => {
      const result = getBudgetPeriodDates(2, 2024, 1);

      expect(result.startDate).toEqual(new Date(2024, 1, 1)); // 1 fév
      expect(result.endDate).toEqual(new Date(2024, 1, 29)); // 29 fév (bissextile)
    });
  });

  describe('1ère quinzaine (payDay <= 15)', () => {
    it('Budget "Mars" avec payDay=5: 5 mars - 4 avril', () => {
      const result = getBudgetPeriodDates(3, 2026, 5);

      expect(result.startDate).toEqual(new Date(2026, 2, 5)); // 5 mars
      expect(result.endDate).toEqual(new Date(2026, 3, 4)); // 4 avril
    });

    it('Budget "Mars" avec payDay=15: 15 mars - 14 avril', () => {
      const result = getBudgetPeriodDates(3, 2026, 15);

      expect(result.startDate).toEqual(new Date(2026, 2, 15)); // 15 mars
      expect(result.endDate).toEqual(new Date(2026, 3, 14)); // 14 avril
    });

    it('Budget "Janvier" avec payDay=5: 5 janvier - 4 février', () => {
      const result = getBudgetPeriodDates(1, 2026, 5);

      expect(result.startDate).toEqual(new Date(2026, 0, 5)); // 5 janvier
      expect(result.endDate).toEqual(new Date(2026, 1, 4)); // 4 février
    });
  });

  describe('2ème quinzaine (payDay > 15)', () => {
    it('Budget "Mars" avec payDay=27: 27 fév - 26 mars', () => {
      const result = getBudgetPeriodDates(3, 2026, 27);

      expect(result.startDate).toEqual(new Date(2026, 1, 27)); // 27 février
      expect(result.endDate).toEqual(new Date(2026, 2, 26)); // 26 mars
    });

    it('Budget "Mars" avec payDay=20: 20 fév - 19 mars', () => {
      const result = getBudgetPeriodDates(3, 2026, 20);

      expect(result.startDate).toEqual(new Date(2026, 1, 20)); // 20 février
      expect(result.endDate).toEqual(new Date(2026, 2, 19)); // 19 mars
    });

    it('Budget "Janvier" avec payDay=27: 27 déc 2025 - 26 jan 2026', () => {
      const result = getBudgetPeriodDates(1, 2026, 27);

      expect(result.startDate).toEqual(new Date(2025, 11, 27)); // 27 décembre 2025
      expect(result.endDate).toEqual(new Date(2026, 0, 26)); // 26 janvier 2026
    });
  });

  describe('Cas limites - fin de mois', () => {
    it('Budget "Mars" avec payDay=30: 28 fév - 29 mars (février court)', () => {
      const result = getBudgetPeriodDates(3, 2026, 30);

      // Février 2026 n'a que 28 jours, payDay clampé à 28
      expect(result.startDate).toEqual(new Date(2026, 1, 28)); // 28 février
      expect(result.endDate).toEqual(new Date(2026, 2, 29)); // 29 mars
    });

    it('Budget "Décembre" avec payDay=5: 5 déc - 4 jan année suivante', () => {
      const result = getBudgetPeriodDates(12, 2025, 5);

      expect(result.startDate).toEqual(new Date(2025, 11, 5)); // 5 décembre
      expect(result.endDate).toEqual(new Date(2026, 0, 4)); // 4 janvier 2026
    });
  });
});

describe('formatBudgetPeriod', () => {
  it('formate une période calendaire', () => {
    const result = formatBudgetPeriod(3, 2026, 1, 'fr-CH');

    // Format attendu: "1 mars - 31 mars" (dépend de l'implémentation Intl)
    expect(result).toMatch(/1.*mars.*31.*mars/i);
  });

  it('formate une période 1ère quinzaine', () => {
    const result = formatBudgetPeriod(3, 2026, 5, 'fr-CH');

    // Format attendu: "5 mars - 4 avr"
    expect(result).toMatch(/5.*mars.*4.*avr/i);
  });

  it('formate une période 2ème quinzaine', () => {
    const result = formatBudgetPeriod(3, 2026, 27, 'fr-CH');

    // Format attendu: "27 fév - 26 mars"
    expect(result).toMatch(/27.*f[eé]v.*26.*mars/i);
  });

  it('inclut le séparateur -', () => {
    const result = formatBudgetPeriod(3, 2026, 5, 'fr-CH');

    expect(result).toContain(' - ');
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
