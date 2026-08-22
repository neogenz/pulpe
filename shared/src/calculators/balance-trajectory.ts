/**
 * @fileoverview Trajectoire de solde — où la période est prévue d'atterrir,
 * relue une fois par jour écoulé.
 *
 * MIROIR SWIFT : `ios/Pulpe/Domain/Formulas/BalanceTrajectory.swift`. Toute
 * modif ici se fait aussi là-bas, tests inclus, même commit — rien ne casse le
 * build quand les deux divergent (voir
 * `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`).
 *
 * Tourne côté client parce que le hero la redessine pendant que l'utilisateur
 * pointe ses opérations : un aller-retour serveur par pointage n'est pas une
 * option.
 *
 * NOTE: L'import utilise l'extension .js (pas .ts) - exigence ESM Node.js
 */

import { getBudgetPeriodDates } from './budget-period.js';
import { BudgetFormulas, isOutflowKind } from './budget-formulas.js';
import type { TransactionKind } from '../types.js';

const MILLISECONDS_PER_DAY = 86_400_000;

interface TrajectoryBudgetLine {
  id: string;
  kind: TransactionKind;
  amount: number;
  isRollover?: boolean;
}

interface TrajectoryTransaction {
  kind: TransactionKind;
  amount: number;
  budgetLineId?: string | null;
  /** ISO 8601 avec offset, tel que renvoyé par l'API. */
  transactionDate: string;
}

interface TrajectoryBudget {
  month: number;
  year: number;
  rollover?: number | null;
}

export interface BalanceTrajectoryPoint {
  day: number;
  balance: number;
}

export interface BalanceTrajectory {
  /** Une lecture par jour écoulé, de l'ouverture (le plan seul) à aujourd'hui. */
  landing: BalanceTrajectoryPoint[];

  /**
   * Le jour où la prévision a quitté pour la première fois le plan sur lequel
   * elle s'est ouverte. `null` tant que le mois atterrit exactement là où il
   * était prévu — un état fréquent et valide, pas une absence de mesure.
   */
  driftDate: Date | null;

  /**
   * Ce que la période prévoyait de dépenser. Le graphe plancher son échelle
   * verticale sur une fraction de cette valeur, pour qu'un mois qui a peu bougé
   * ne soit pas dilaté jusqu'à remplir le cadre.
   */
  plannedOutflows: number;

  today: number;
  totalDays: number;

  /**
   * Là où le plan seul disait que la période atterrirait. Égal au « restant
   * prévu » par construction : le jour 0 n'a aucune transaction, donc la même
   * arithmétique d'enveloppe qui produit le plan produit cette valeur.
   */
  plannedBalance: number;

  /** Là où elle est désormais prévue d'atterrir : le chiffre du hero. */
  estimatedBalance: number;

  /** L'écart que le graphe dessine — et le « vs prévu » de la carte. */
  drift: number;
}

export interface BalanceTrajectoryInput {
  budgetLines: TrajectoryBudgetLine[];
  transactions: TrajectoryTransaction[];
  budget: TrajectoryBudget;
  payDayOfMonth?: number | null;
  referenceDate?: Date;
}

/**
 * Rejoue l'arithmétique d'enveloppe du hero contre les transactions que chaque
 * jour connaissait, pour que la ligne s'ouvre sur le plan et arrive sur
 * l'estimation.
 *
 * Retourne `null` quand la date de référence tombe hors de la période : une
 * trajectoire ne se lit que pendant le mois qu'elle décrit.
 */
export function calculateBalanceTrajectory({
  budgetLines,
  transactions,
  budget,
  payDayOfMonth,
  referenceDate = new Date(),
}: BalanceTrajectoryInput): BalanceTrajectory | null {
  const { startDate, endDate } = getBudgetPeriodDates(
    budget.month,
    budget.year,
    payDayOfMonth,
  );
  const periodStart = startOfDay(startDate);
  const periodEnd = startOfDay(endDate);
  const referenceDay = startOfDay(referenceDate);

  if (referenceDay < periodStart || referenceDay > periodEnd) return null;

  const totalDays = Math.max(countDaysBetween(periodStart, periodEnd) + 1, 1);
  const today = Math.min(
    Math.max(countDaysBetween(periodStart, referenceDay) + 1, 1),
    totalDays,
  );

  const landing = landingSeries({
    budgetLines,
    transactions,
    rollover: budget.rollover ?? 0,
    periodStart,
    today,
  });

  const opening = landing[0];
  if (opening === undefined) return null;

  const plannedBalance = opening.balance;
  const estimatedBalance = landing[landing.length - 1]?.balance ?? 0;

  return {
    landing,
    // Une lecture à l'index `d` couvre les jours qui la précèdent, donc la
    // première qui diffère a été déplacée par l'activité du jour où elle s'est
    // ouverte — un cran avant son propre index.
    driftDate: firstDriftDate(landing, plannedBalance, periodStart),
    plannedOutflows: budgetLines
      .filter((line) => isOutflowKind(line.kind) && line.isRollover !== true)
      .reduce((total, line) => total + line.amount, 0),
    today,
    totalDays,
    plannedBalance,
    estimatedBalance,
    drift: estimatedBalance - plannedBalance,
  };
}

interface LandingSeriesInput {
  budgetLines: TrajectoryBudgetLine[];
  transactions: TrajectoryTransaction[];
  rollover: number;
  periodStart: Date;
  today: number;
}

/**
 * Une lecture par jour écoulé, chacune posant la même question à une quantité
 * de connaissance différente : au vu de ce qui est enregistré ce matin, où la
 * période atterrit-elle ?
 */
function landingSeries({
  budgetLines,
  transactions,
  rollover,
  periodStart,
  today,
}: LandingSeriesInput): BalanceTrajectoryPoint[] {
  const points: BalanceTrajectoryPoint[] = [];

  for (let day = 0; day <= today; day += 1) {
    // La dernière lecture est celle du hero, donc elle prend ses entrées
    // telles quelles : une transaction datée hors période dépense de l'argent
    // réel, et doit être comptée quand la ligne arrive sur le chiffre imprimé
    // au-dessus d'elle.
    if (day === today) {
      points.push({
        day,
        balance: landingBalance(budgetLines, transactions, rollover),
      });
      continue;
    }

    const endExclusive = addDays(periodStart, day).getTime();
    const known = transactions.filter((transaction) => {
      const date = new Date(transaction.transactionDate).getTime();
      return date >= periodStart.getTime() && date < endExclusive;
    });

    points.push({ day, balance: landingBalance(budgetLines, known, rollover) });
  }

  return points;
}

/**
 * Le même appel que celui du hero. Le réutiliser est tout l'intérêt : une copie
 * privée des règles d'enveloppe ici pourrait diverger du chiffre affiché
 * au-dessus du graphe. Elle ne lit aucun `checkedAt`, ce qui explique que
 * pointer une opération laisse la ligne plate.
 */
function landingBalance(
  budgetLines: TrajectoryBudgetLine[],
  transactions: TrajectoryTransaction[],
  rollover: number,
): number {
  return BudgetFormulas.calculateAllMetrics(budgetLines, transactions, rollover)
    .remaining;
}

function firstDriftDate(
  landing: BalanceTrajectoryPoint[],
  plannedBalance: number,
  periodStart: Date,
): Date | null {
  const drifted = landing.find((point) => point.balance !== plannedBalance);
  return drifted === undefined ? null : addDays(periodStart, drifted.day - 1);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Arrondi plutôt que tronqué : une période qui traverse un changement d'heure
 * compte 23 ou 25 heures sur l'un de ses jours, et le plancher le perdrait.
 */
function countDaysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}
