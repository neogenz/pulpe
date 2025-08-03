export class UserProfileUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly changes: {
      firstName?: string;
      lastName?: string;
    },
  ) {}
}
