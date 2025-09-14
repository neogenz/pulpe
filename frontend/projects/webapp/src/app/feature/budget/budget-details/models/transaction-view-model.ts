import { type Transaction } from '@pulpe/shared';

export type TransactionViewModel = Transaction & {
  isEditing?: boolean;
  isDeleting?: boolean;
  isUpdating?: boolean;
};
