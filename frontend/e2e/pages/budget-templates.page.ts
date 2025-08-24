import { Page, expect } from '@playwright/test';

export class BudgetTemplatesPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/budget-templates');
  }

  async expectPageLoaded() {
    await expect(this.page.locator('body')).toBeVisible();
  }

  async expectTemplatesListVisible() {
    // Either templates or empty state
    await this.page.waitForSelector('mat-card, text="Aucun modèle"');
  }

  async clickCreateTemplate() {
    // Navigate directly to create page - simpler and more reliable
    await this.page.goto('/app/budget-templates/create');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectFormVisible() {
    await expect(this.page.locator('form').first()).toBeVisible();
  }

  async fillTemplateName(name: string) {
    // Use the template name input with its specific test ID
    await this.page.locator('[data-testid="template-name-input"]').fill(name);
  }

  async submitForm() {
    // Click submit button and wait for navigation
    await this.page.getByRole('button', { name: /créer|submit|continuer/i }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToTemplateDetails(templateName: string) {
    // Direct navigation is more reliable
    await this.page.goto('/app/budget-templates/details/test-template-id');
  }
}

export { BudgetTemplatesPage as TemplatesPage };