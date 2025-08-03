export class DeleteTemplateLineCommand {
  constructor(
    public readonly templateId: string,
    public readonly lineId: string,
    public readonly userId: string,
  ) {}
}
