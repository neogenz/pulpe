export class UserSignedInEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly signedInAt: Date = new Date(),
  ) {}
}
