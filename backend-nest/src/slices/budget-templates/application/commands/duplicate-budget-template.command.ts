export class DuplicateBudgetTemplateCommand {
  constructor(
    public readonly templateId: string,
    public readonly userId: string,
    public readonly newName: string,
  ) {}
}
