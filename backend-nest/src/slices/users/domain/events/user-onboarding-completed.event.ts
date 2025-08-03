export class UserOnboardingCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly completedAt: Date,
  ) {}
}
