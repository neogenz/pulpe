export * from './create-budget-line.handler';
export * from './update-budget-line.handler';
export * from './delete-budget-line.handler';
export * from './bulk-create-budget-lines.handler';
export * from './get-budget-line.handler';
export * from './list-budget-lines.handler';
export * from './get-budget-lines-by-budget.handler';

import { CreateBudgetLineHandler } from './create-budget-line.handler';
import { UpdateBudgetLineHandler } from './update-budget-line.handler';
import { DeleteBudgetLineHandler } from './delete-budget-line.handler';
import { BulkCreateBudgetLinesHandler } from './bulk-create-budget-lines.handler';
import { GetBudgetLineHandler } from './get-budget-line.handler';
import { ListBudgetLinesHandler } from './list-budget-lines.handler';
import { GetBudgetLinesByBudgetHandler } from './get-budget-lines-by-budget.handler';

export const BudgetLineCommandHandlers = [
  CreateBudgetLineHandler,
  UpdateBudgetLineHandler,
  DeleteBudgetLineHandler,
  BulkCreateBudgetLinesHandler,
];

export const BudgetLineQueryHandlers = [
  GetBudgetLineHandler,
  ListBudgetLinesHandler,
  GetBudgetLinesByBudgetHandler,
];

export const BudgetLineHandlers = [
  ...BudgetLineCommandHandlers,
  ...BudgetLineQueryHandlers,
];
