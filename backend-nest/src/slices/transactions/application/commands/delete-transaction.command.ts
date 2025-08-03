export class DeleteTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
