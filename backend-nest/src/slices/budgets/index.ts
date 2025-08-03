export { BudgetSliceModule } from './budget.module';

// Export domain entities and value objects for use in other slices
export { Budget } from './domain/entities/budget.entity';
export { BudgetPeriod } from './domain/value-objects/budget-period.value-object';
export { BudgetRepository } from './domain/repositories/budget.repository';

// Export events for event bus integration
export { BudgetCreatedEvent } from './domain/events/budget-created.event';
export { BudgetUpdatedEvent } from './domain/events/budget-updated.event';
export { BudgetDeletedEvent } from './domain/events/budget-deleted.event';
