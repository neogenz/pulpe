export { TransactionSliceModule } from './transaction.module';

// Export domain entities and value objects for use in other slices
export { Transaction } from './domain/entities/transaction.entity';
export { TransactionAmount } from './domain/value-objects/transaction-amount.value-object';
export { TransactionRepository } from './domain/repositories/transaction.repository';

// Export events for event bus integration
export { TransactionCreatedEvent } from './domain/events/transaction-created.event';
export { TransactionUpdatedEvent } from './domain/events/transaction-updated.event';
export { TransactionDeletedEvent } from './domain/events/transaction-deleted.event';
