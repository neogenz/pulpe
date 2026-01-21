import { Page, expect } from '@playwright/test';

export class BudgetTemplatesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/budget-templates');
    await this.expectPageLoaded();
  }

  async expectPageLoaded() {
    await expect(this.page.getByTestId('budget-templates-page')).toBeVisible();
  }

  async clickCreateTemplate() {
    await this.page.getByTestId('create-template-button').click();
  }

  async fillTemplateName(name: string) {
    await this.page.getByTestId('template-name-input').fill(name);
  }

  async submitForm() {
    await this.page.getByTestId('template-submit-button').click();
  }

  async navigateToTemplateDetails(templateName: string) {
    await this.page.getByTestId(`template-${templateName}`).getByTestId('view-details-button').click();
  }

  async expectTemplateVisible(templateName: string) {
    await expect(this.page.getByTestId(`template-${templateName}`)).toBeVisible();
  }
}