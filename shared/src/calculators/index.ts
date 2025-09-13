/**
 * @fileoverview Export public des calculateurs métier
 *
 * NOTE IMPORTANTE: Les imports utilisent l'extension .js (pas .ts) car ce package
 * est compilé en ESM natif pour Node.js. C'est une exigence stricte de Node.js
 * pour la résolution des modules ESM, même si nous écrivons en TypeScript.
 *
 * Sans ces extensions .js, l'application crash en production avec ERR_MODULE_NOT_FOUND.
 * Voir shared/README.md section "Résolution des Modules ESM" pour plus de détails.
 */

export { BudgetFormulas } from './budget-formulas.js';
export type * from '../types.js';
