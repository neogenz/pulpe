import type { Database } from '../../../types/database.types';

export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
export type TransactionInsert =
  Database['public']['Tables']['transaction']['Insert'];
export type TransactionUpdate =
  Database['public']['Tables']['transaction']['Update'];
