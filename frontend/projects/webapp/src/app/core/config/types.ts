/**
 * Re-export types from the Zod schema for backward compatibility.
 * The schema is now the single source of truth for configuration types.
 */
export type { ApplicationConfig, ConfigFile } from './config.schema';
