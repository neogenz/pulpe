export { UserSliceModule } from './user.module';

// Export domain entities for use in other slices
export { User } from './domain/entities/user.entity';
export { UserRepository } from './domain/repositories/user.repository';

// Export events for event bus integration
export { UserProfileUpdatedEvent } from './domain/events/user-profile-updated.event';
export { UserOnboardingCompletedEvent } from './domain/events/user-onboarding-completed.event';
export { UserDeletedEvent } from './domain/events/user-deleted.event';
