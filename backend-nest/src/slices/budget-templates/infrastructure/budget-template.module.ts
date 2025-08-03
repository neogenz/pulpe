import { Module, Scope } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { BudgetTemplateController } from './api/budget-template.controller';
import { SupabaseBudgetTemplateRepository } from './persistence/supabase-budget-template.repository';
import { BudgetTemplateMapper } from './persistence/budget-template.mapper';
import { BUDGET_TEMPLATE_REPOSITORY_TOKEN } from '../domain/repositories/budget-template.repository';
import { BudgetTemplateHandlers } from '../application/handlers';

@Module({
  imports: [CqrsModule],
  controllers: [BudgetTemplateController],
  providers: [
    BudgetTemplateMapper,
    ...BudgetTemplateHandlers,
    {
      provide: BUDGET_TEMPLATE_REPOSITORY_TOKEN,
      useClass: SupabaseBudgetTemplateRepository,
      scope: Scope.REQUEST,
    },
    {
      provide: SupabaseBudgetTemplateRepository,
      useFactory: (request: Request) => {
        const client = request.supabaseClient as SupabaseClient<Database>;
        const repository = new SupabaseBudgetTemplateRepository(request.logger);
        // Inject the client using a setter or through a method
        (repository as any).client = client;
        // Override the getClient method
        (repository as any).getClient = function () {
          return this.client;
        };
        return repository;
      },
      inject: [REQUEST],
      scope: Scope.REQUEST,
    },
  ],
  exports: [BUDGET_TEMPLATE_REPOSITORY_TOKEN],
})
export class BudgetTemplateModule {}
