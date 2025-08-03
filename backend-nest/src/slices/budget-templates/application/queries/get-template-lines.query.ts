export class GetTemplateLinesQuery {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
  ) {}
}
