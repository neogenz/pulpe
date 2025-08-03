export class SignUpCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly firstName?: string,
    public readonly lastName?: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
