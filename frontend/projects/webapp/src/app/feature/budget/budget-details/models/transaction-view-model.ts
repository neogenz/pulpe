import { type Transaction } from 'pulpe-shared';

export type TransactionViewModel = Transaction & {
  isDeleting?: boolean;
  isUpdating?: boolean;
};
