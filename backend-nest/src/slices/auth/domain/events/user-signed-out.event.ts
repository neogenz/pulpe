export class UserSignedOutEvent {
  constructor(
    public readonly userId: string,
    public readonly signedOutAt: Date = new Date(),
  ) {}
}
