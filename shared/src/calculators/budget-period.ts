/**
 * @fileoverview BUDGET PERIOD - Utilitaires pour calculer la période budgétaire
 *
 * Permet de déterminer à quel mois budgétaire une date appartient,
 * en tenant compte d'un jour de paie personnalisé.
 *
 * Exemple avec payDayOfMonth = 27 :
 * - 26 décembre 2024 → décembre 2024 (avant le jour de paie)
 * - 27 décembre 2024 → janvier 2025 (jour de paie = début nouveau mois)
 * - 28 décembre 2024 → janvier 2025 (après le jour de paie)
 */

/**
 * Représente une période budgétaire (mois/année)
 */
export interface BudgetPeriod {
  month: number; // 1-12
  year: number;
}

/**
 * Détermine la période budgétaire pour une date donnée.
 *
 * @param date - La date pour laquelle calculer la période
 * @param payDayOfMonth - Le jour du mois où commence la nouvelle période (1-31).
 *                        Si undefined, null ou 1, utilise le comportement calendaire standard.
 * @returns La période budgétaire { month, year }
 *
 * @example
 * // Comportement standard (calendaire)
 * getBudgetPeriodForDate(new Date('2024-12-28')) // → { month: 12, year: 2024 }
 *
 * @example
 * // Avec jour de paie personnalisé
 * getBudgetPeriodForDate(new Date('2024-12-28'), 27) // → { month: 1, year: 2025 }
 * getBudgetPeriodForDate(new Date('2024-12-26'), 27) // → { month: 12, year: 2024 }
 */
export function getBudgetPeriodForDate(
  date: Date,
  payDayOfMonth?: number | null,
): BudgetPeriod {
  const calendarMonth = date.getMonth() + 1; // 1-12
  const calendarYear = date.getFullYear();
  const dayOfMonth = date.getDate();

  // Si pas de jour de paie personnalisé ou jour = 1, comportement calendaire standard
  if (!payDayOfMonth || payDayOfMonth === 1) {
    return { month: calendarMonth, year: calendarYear };
  }

  // Valider le jour de paie (1-31)
  const validPayDay = Math.max(1, Math.min(31, Math.floor(payDayOfMonth)));

  // Si on a atteint ou dépassé le jour de paie, on est dans le mois suivant
  if (dayOfMonth >= validPayDay) {
    // Passer au mois suivant
    if (calendarMonth === 12) {
      return { month: 1, year: calendarYear + 1 };
    }
    return { month: calendarMonth + 1, year: calendarYear };
  }

  // Sinon on reste dans le mois calendaire courant
  return { month: calendarMonth, year: calendarYear };
}

/**
 * Détermine si une date donnée est dans la période budgétaire courante.
 *
 * @param date - La date à vérifier
 * @param payDayOfMonth - Le jour du mois où commence la nouvelle période
 * @returns true si la date est dans la période budgétaire courante
 */
export function isInCurrentBudgetPeriod(
  date: Date,
  payDayOfMonth?: number | null,
): boolean {
  const today = new Date();
  const currentPeriod = getBudgetPeriodForDate(today, payDayOfMonth);
  const datePeriod = getBudgetPeriodForDate(date, payDayOfMonth);

  return (
    currentPeriod.month === datePeriod.month &&
    currentPeriod.year === datePeriod.year
  );
}

/**
 * Compare deux périodes budgétaires.
 *
 * @param a - Première période
 * @param b - Deuxième période
 * @returns -1 si a < b, 0 si a === b, 1 si a > b
 */
export function compareBudgetPeriods(a: BudgetPeriod, b: BudgetPeriod): number {
  if (a.year !== b.year) {
    return a.year < b.year ? -1 : 1;
  }
  if (a.month !== b.month) {
    return a.month < b.month ? -1 : 1;
  }
  return 0;
}

/**
 * Vérifie si une période est dans le passé par rapport à la période courante.
 *
 * @param period - La période à vérifier
 * @param payDayOfMonth - Le jour du mois où commence la nouvelle période
 * @returns true si la période est dans le passé
 */
export function isPastBudgetPeriod(
  period: BudgetPeriod,
  payDayOfMonth?: number | null,
): boolean {
  const currentPeriod = getBudgetPeriodForDate(new Date(), payDayOfMonth);
  return compareBudgetPeriods(period, currentPeriod) < 0;
}
