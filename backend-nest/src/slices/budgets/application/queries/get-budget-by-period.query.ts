export class GetBudgetByPeriodQuery {
  constructor(
    public readonly month: number,
    public readonly year: number,
    public readonly userId: string,
  ) {}
}
