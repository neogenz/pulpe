export class SignInCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}
