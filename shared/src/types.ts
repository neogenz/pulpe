/**
 * @fileoverview Types partagés pour les calculs métier
 * Réexport des types principaux depuis schemas.ts
 *
 * NOTE: L'export utilise l'extension .js (pas .ts) - contrainte ESM Node.js
 * Cette extension référence le fichier JavaScript compilé, pas le source TypeScript.
 * Voir shared/README.md section "Résolution des Modules ESM" pour comprendre pourquoi.
 */

export type { TransactionKind, TransactionRecurrence } from '../schemas.js';
