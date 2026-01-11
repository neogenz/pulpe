/**
 * @fileoverview BUDGET PERIOD - Utilitaires pour calculer la période budgétaire
 *
 * Permet de déterminer à quel mois budgétaire une date appartient,
 * en tenant compte d'un jour de paie personnalisé et de la règle "quinzaine".
 *
 * RÈGLE QUINZAINE (détermine comment nommer le budget):
 * - payDay <= 15 (1ère quinzaine): Le budget est nommé d'après le mois où COMMENCE la période
 *   → Budget "Mars" couvre: 5 mars - 4 avril (majorité en mars)
 * - payDay > 15 (2ème quinzaine): Le budget est nommé d'après le mois où FINIT la période
 *   → Budget "Mars" couvre: 27 fév - 26 mars (majorité en mars)
 *
 * Le nom du budget correspond au mois contenant la MAJORITÉ des jours de la période.
 *
 * Exemple avec payDayOfMonth = 5 (1ère quinzaine):
 * - 4 mars 2025 → février 2025 (période fév: 5 fév - 4 mars)
 * - 5 mars 2025 → mars 2025 (période mars: 5 mars - 4 avril)
 *
 * Exemple avec payDayOfMonth = 27 (2ème quinzaine):
 * - 26 janvier 2025 → janvier 2025 (période jan: 27 déc - 26 jan)
 * - 27 janvier 2025 → février 2025 (période fév: 27 jan - 26 fév)
 */

import { PAY_DAY_MIN, PAY_DAY_MAX } from '../../schemas.js';

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
 * Applique la règle "quinzaine" pour déterminer le nom du budget:
 * - payDay <= 15: le budget est nommé d'après le mois de début de période
 * - payDay > 15: le budget est nommé d'après le mois de fin de période
 *
 * @param date - La date pour laquelle calculer la période
 * @param payDayOfMonth - Le jour du mois où arrive la paie (1-31).
 *                        Si undefined, null ou 1, utilise le comportement calendaire standard.
 * @returns La période budgétaire { month, year }
 *
 * @example
 * // Comportement standard (calendaire)
 * getBudgetPeriodForDate(new Date('2025-01-28')) // → { month: 1, year: 2025 }
 *
 * @example
 * // Avec jour de paie au 5 (1ère quinzaine)
 * getBudgetPeriodForDate(new Date('2025-01-06'), 5) // → { month: 1, year: 2025 } (période jan: 5 jan - 4 fév)
 * getBudgetPeriodForDate(new Date('2025-01-04'), 5) // → { month: 12, year: 2024 } (période déc: 5 déc - 4 jan)
 *
 * @example
 * // Avec jour de paie au 27 (2ème quinzaine)
 * getBudgetPeriodForDate(new Date('2025-01-28'), 27) // → { month: 2, year: 2025 } (période fév: 27 jan - 26 fév)
 * getBudgetPeriodForDate(new Date('2025-01-26'), 27) // → { month: 1, year: 2025 } (période jan: 27 déc - 26 jan)
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
  const validPayDay = Math.max(
    PAY_DAY_MIN,
    Math.min(PAY_DAY_MAX, Math.floor(payDayOfMonth)),
  );

  // Calculer la période de base
  let resultMonth: number;
  let resultYear: number;

  if (dayOfMonth >= validPayDay) {
    // On a atteint ou dépassé le jour de paie → période du mois calendaire
    resultMonth = calendarMonth;
    resultYear = calendarYear;
  } else {
    // Avant le jour de paie → période du mois précédent
    if (calendarMonth === 1) {
      resultMonth = 12;
      resultYear = calendarYear - 1;
    } else {
      resultMonth = calendarMonth - 1;
      resultYear = calendarYear;
    }
  }

  // Appliquer la règle quinzaine: si payDay > 15, ajouter 1 mois au résultat
  // Car le budget est nommé d'après le mois de FIN (où se trouve la majorité des jours)
  if (validPayDay > 15) {
    if (resultMonth === 12) {
      resultMonth = 1;
      resultYear = resultYear + 1;
    } else {
      resultMonth = resultMonth + 1;
    }
  }

  return { month: resultMonth, year: resultYear };
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

/**
 * Représente les dates de début et fin d'une période budgétaire
 */
export interface BudgetPeriodDates {
  startDate: Date;
  endDate: Date;
}

/**
 * Retourne le dernier jour du mois pour une date donnée
 */
function getLastDayOfMonth(year: number, month: number): number {
  // Mois en JS: 0-11, donc month=1 (janvier) devient 0
  // new Date(year, month, 0) retourne le dernier jour du mois précédent
  // Donc new Date(year, month, 0) avec month=2 retourne le dernier jour de janvier
  return new Date(year, month, 0).getDate();
}

/**
 * Calcule les dates de début et fin d'une période budgétaire.
 *
 * @param month - Le mois du budget (1-12)
 * @param year - L'année du budget
 * @param payDayOfMonth - Le jour du mois où arrive la paie (1-31).
 *                        Si undefined, null ou 1, utilise le comportement calendaire standard.
 * @returns Les dates de début et fin { startDate, endDate }
 *
 * @example
 * // Comportement calendaire (payDay = 1)
 * getBudgetPeriodDates(3, 2026, 1)
 * // → { startDate: 1 mars 2026, endDate: 31 mars 2026 }
 *
 * @example
 * // 1ère quinzaine (payDay = 5)
 * getBudgetPeriodDates(3, 2026, 5)
 * // → { startDate: 5 mars 2026, endDate: 4 avril 2026 }
 *
 * @example
 * // 2ème quinzaine (payDay = 27)
 * getBudgetPeriodDates(3, 2026, 27)
 * // → { startDate: 27 fév 2026, endDate: 26 mars 2026 }
 */
export function getBudgetPeriodDates(
  month: number,
  year: number,
  payDayOfMonth?: number | null,
): BudgetPeriodDates {
  // Normaliser le jour de paie
  const payDay =
    payDayOfMonth && payDayOfMonth > 1
      ? Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, Math.floor(payDayOfMonth)))
      : 1;

  let startMonth: number;
  let startYear: number;

  if (payDay === 1) {
    // Comportement calendaire: période = mois calendaire complet
    startMonth = month;
    startYear = year;
  } else if (payDay <= 15) {
    // 1ère quinzaine: la période commence le payDay du MÊME mois
    startMonth = month;
    startYear = year;
  } else {
    // 2ème quinzaine: la période commence le payDay du mois PRÉCÉDENT
    if (month === 1) {
      startMonth = 12;
      startYear = year - 1;
    } else {
      startMonth = month - 1;
      startYear = year;
    }
  }

  // Calculer le jour de début (clampé au dernier jour du mois si nécessaire)
  const lastDayOfStartMonth = getLastDayOfMonth(startYear, startMonth);
  const actualStartDay = Math.min(payDay, lastDayOfStartMonth);

  // Date de début (mois JS: 0-11)
  const startDate = new Date(startYear, startMonth - 1, actualStartDay);

  // Calculer la date de fin
  let endDate: Date;

  if (payDay === 1) {
    // Comportement calendaire: fin = dernier jour du mois
    const lastDay = getLastDayOfMonth(year, month);
    endDate = new Date(year, month - 1, lastDay);
  } else {
    // Fin = veille du prochain payDay (payDay - 1 du mois suivant start)
    let endMonth: number;
    let endYear: number;

    if (startMonth === 12) {
      endMonth = 1;
      endYear = startYear + 1;
    } else {
      endMonth = startMonth + 1;
      endYear = startYear;
    }

    const lastDayOfEndMonth = getLastDayOfMonth(endYear, endMonth);
    const actualEndDay = Math.min(payDay - 1, lastDayOfEndMonth);

    // Si payDay = 1, actualEndDay serait 0, donc on prend le dernier jour du mois précédent
    if (actualEndDay <= 0) {
      // Cas improbable mais géré: fin = dernier jour du startMonth
      endDate = new Date(startYear, startMonth - 1, lastDayOfStartMonth);
    } else {
      endDate = new Date(endYear, endMonth - 1, actualEndDay);
    }
  }

  return { startDate, endDate };
}

/**
 * Formate une période budgétaire en chaîne lisible.
 *
 * @param month - Le mois du budget (1-12)
 * @param year - L'année du budget
 * @param payDayOfMonth - Le jour du mois où arrive la paie (1-31)
 * @param locale - La locale pour le formatage (par défaut 'fr-CH')
 * @returns Une chaîne formatée comme "27 fév - 26 mars"
 *
 * @example
 * formatBudgetPeriod(3, 2026, 27) // → "27 fév - 26 mars"
 * formatBudgetPeriod(3, 2026, 5)  // → "5 mars - 4 avr"
 * formatBudgetPeriod(3, 2026, 1)  // → "1 mars - 31 mars"
 */
export function formatBudgetPeriod(
  month: number,
  year: number,
  payDayOfMonth?: number | null,
  locale: string = 'fr-CH',
): string {
  const { startDate, endDate } = getBudgetPeriodDates(
    month,
    year,
    payDayOfMonth,
  );

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
  });

  const startStr = formatter.format(startDate);
  const endStr = formatter.format(endDate);

  return `${startStr} - ${endStr}`;
}
