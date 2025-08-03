export class GetTransactionQuery {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
