export * from './create-budget-template.handler';
export * from './duplicate-budget-template.handler';
export * from './get-budget-template.handler';
export * from './update-budget-template.handler';
export * from './delete-budget-template.handler';
export * from './list-budget-templates.handler';
export * from './add-template-line.handler';
export * from './update-template-line.handler';
export * from './delete-template-line.handler';
export * from './get-template-lines.handler';

import { CreateBudgetTemplateHandler } from './create-budget-template.handler';
import { DuplicateBudgetTemplateHandler } from './duplicate-budget-template.handler';
import { GetBudgetTemplateHandler } from './get-budget-template.handler';
import { UpdateBudgetTemplateHandler } from './update-budget-template.handler';
import { DeleteBudgetTemplateHandler } from './delete-budget-template.handler';
import { ListBudgetTemplatesHandler } from './list-budget-templates.handler';
import { AddTemplateLineHandler } from './add-template-line.handler';
import { UpdateTemplateLineHandler } from './update-template-line.handler';
import { DeleteTemplateLineHandler } from './delete-template-line.handler';
import { GetTemplateLinesHandler } from './get-template-lines.handler';

export const BudgetTemplateCommandHandlers = [
  CreateBudgetTemplateHandler,
  DuplicateBudgetTemplateHandler,
  UpdateBudgetTemplateHandler,
  DeleteBudgetTemplateHandler,
  AddTemplateLineHandler,
  UpdateTemplateLineHandler,
  DeleteTemplateLineHandler,
];

export const BudgetTemplateQueryHandlers = [
  GetBudgetTemplateHandler,
  ListBudgetTemplatesHandler,
  GetTemplateLinesHandler,
];

export const BudgetTemplateHandlers = [
  ...BudgetTemplateCommandHandlers,
  ...BudgetTemplateQueryHandlers,
];
