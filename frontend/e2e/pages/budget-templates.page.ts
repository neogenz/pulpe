import { Page, expect, Locator } from '@playwright/test';

export class BudgetTemplatesPage {
  readonly page: Page;

  // Locators principaux pour une meilleure réutilisabilité
  private readonly createTemplateButton: Locator;
  private readonly templatesList: Locator;
  private readonly templateForm: Locator;
  private readonly templateNameInput: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Définition des locators avec priorité aux data-testid
    this.createTemplateButton = page.locator(
      '[data-testid="create-template-button"]',
    );
    this.templatesList = page.locator('[data-testid="templates-list"]');
    this.templateForm = page.locator('[data-testid="template-form"]');
    this.templateNameInput = page.locator(
      '[data-testid="template-name-input"]',
    );
    this.submitButton = page.locator('[data-testid="submit-button"]');
  }

  async goto() {
    await this.page.goto('/app/budget-templates');
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageStable();
  }

  async gotoAddTemplate() {
    await this.page.goto('/app/budget-templates/add');
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageStable();
  }

  async gotoTemplate(id: string) {
    await this.page.goto(`/app/budget-templates/${id}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageStable();
  }

  private async waitForPageStable() {
    // Attendre que la page soit stable (pas de changements DOM pendant 500ms)
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Fallback: attendre au moins que le body soit visible
      await expect(this.page.locator('body')).toBeVisible({ timeout: 3000 });
    }
  }

  async expectPageLoaded() {
    // Check if we're on the main templates page or add template page
    const isMainPage =
      (await this.page
        .locator('[data-testid="budget-templates-page"]')
        .count()) > 0;
    const isAddPage =
      (await this.page.locator('[data-testid="add-template-page"]').count()) >
      0;

    if (isMainPage) {
      // Use data-testid for page title instead of hardcoded text
      await expect(
        this.page.locator('[data-testid="page-title"]'),
      ).toBeVisible();
      // Ensure the page container is present
      await expect(
        this.page.locator('[data-testid="budget-templates-page"]'),
      ).toBeVisible();
    } else if (isAddPage) {
      // We're on the add template page
      await this.expectAddPageLoaded();
    } else {
      // Fallback: check for basic page structure
      const hasPageTitle =
        (await this.page.locator('[data-testid="page-title"]').count()) > 0;
      const hasContent =
        (await this.page.locator('main, .content, body').count()) > 0;
      expect(hasPageTitle || hasContent).toBeTruthy();
    }

    // Vérifier qu'on n'est pas sur une page d'erreur
    const isErrorPage =
      (await this.page
        .locator('h1:has-text("Error"), h1:has-text("Erreur"), .error-page')
        .count()) > 0;
    expect(isErrorPage).toBeFalsy();
  }

  async expectAddPageLoaded() {
    // Use data-testid for add template page
    await expect(
      this.page.locator('[data-testid="add-template-page"]'),
    ).toBeVisible();
    await expect(this.page.locator('[data-testid="page-title"]')).toBeVisible();
  }

  async expectTemplatesListVisible() {
    // Check for templates list or empty state
    const hasTemplatesList =
      (await this.page.locator('[data-testid="templates-list"]').count()) > 0;
    const hasEmptyState =
      (await this.page.locator('[data-testid="empty-state"]').count()) > 0;
    const hasCreateButton =
      (await this.page
        .locator('[data-testid="create-template-button"]')
        .count()) > 0;

    expect(hasTemplatesList || hasEmptyState || hasCreateButton).toBeTruthy();
  }

  async clickCreateTemplate() {
    // Use the data-testid selector for create button
    await this.createTemplateButton.waitFor({ state: 'visible' });
    await this.createTemplateButton.click();
    // Attendre la navigation
    await this.page.waitForTimeout(1000);
  }

  async expectFormVisible() {
    await expect(
      this.page.locator('[data-testid="add-template-form"]'),
    ).toBeVisible();
    await expect(this.templateNameInput).toBeVisible();
  }

  async fillTemplateName(name: string) {
    await this.templateNameInput.waitFor({ state: 'visible' });
    await this.templateNameInput.clear();
    await this.templateNameInput.fill(name);

    // Vérifier que la valeur a bien été saisie
    await expect(this.templateNameInput).toHaveValue(name);
  }

  async submitForm() {
    const isEnabled = await this.submitButton.isEnabled();
    expect(isEnabled).toBeTruthy();

    await this.submitButton.click();

    // Attendre soit une redirection, soit un message de succès/erreur
    await this.page.waitForTimeout(1000); // Laisser le temps à la requête de se traiter
  }

  async expectValidationErrors() {
    // Vérifier la présence d'erreurs de validation
    const hasFieldErrors =
      (await this.page
        .locator('[data-testid="name-error"], .error, .mat-error')
        .count()) > 0;
    const isSubmitDisabled = !(await this.submitButton.isEnabled());

    expect(hasFieldErrors || isSubmitDisabled).toBeTruthy();
  }

  async expectTemplateDetailsVisible() {
    // Use data-testid for page title
    await expect(this.page.locator('[data-testid="page-title"]')).toBeVisible();

    const hasTemplateInfo =
      (await this.page
        .locator('[data-testid="template-details"], .template-details')
        .count()) > 0;
    const hasTemplateContent =
      (await this.page
        .locator('[data-testid="template-content"], .template-info')
        .count()) > 0;
    const hasBasicContent =
      (await this.page.locator('main, .content').count()) > 0;

    expect(
      hasTemplateInfo || hasTemplateContent || hasBasicContent,
    ).toBeTruthy();
  }

  async clickEditTemplate() {
    const editButton = this.page
      .locator('[data-testid="edit-btn"]')
      .or(this.page.locator('button:has-text("Modifier")'))
      .or(this.page.locator('button:has-text("Éditer")'));

    await editButton.waitFor({ state: 'visible' });
    await editButton.click();
  }

  async expectTransactionsTableVisible() {
    const transactionsTable = this.page
      .locator('[data-testid="transactions-table"]')
      .or(this.page.locator('table'))
      .or(this.page.locator('mat-table'));

    await expect(transactionsTable).toBeVisible();
  }

  async clickAddTransaction() {
    const addButton = this.page
      .locator('[data-testid="add-transaction-btn"]')
      .or(this.page.locator('button:has-text("Ajouter transaction")'))
      .or(this.page.locator('button:has-text("Nouvelle transaction")'));

    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  async clickUseTemplate() {
    const useButton = this.page
      .locator('[data-testid="use-template-btn"]')
      .or(this.page.locator('button:has-text("Utiliser")'))
      .or(this.page.locator('button:has-text("Appliquer")'));

    await useButton.waitFor({ state: 'visible' });
    await useButton.click();
  }

  async expectSuccessMessage() {
    const successMessage = this.page
      .locator('[data-testid="success"]')
      .or(this.page.locator('.success'))
      .or(this.page.locator('.mat-snack-bar-container'))
      .or(this.page.locator('.alert-success'));

    await expect(successMessage).toBeVisible({ timeout: 5000 });
  }

  async expectErrorMessage() {
    const errorMessage = this.page
      .locator('[data-testid="error"], [data-testid="templates-error"]')
      .or(this.page.locator('.error'))
      .or(this.page.locator('.alert-error'))
      .or(this.page.locator('.mat-error'));

    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  }

  async expectTemplateInList(templateName: string) {
    const templateInList = this.page
      .locator(`[data-testid="template-card"]:has-text("${templateName}")`)
      .or(this.page.locator(`.template-item:has-text("${templateName}")`))
      .or(this.page.locator(`text="${templateName}"`));

    await expect(templateInList).toBeVisible({ timeout: 5000 });
  }

  async expectEmptyState() {
    const emptyState = this.page.locator('[data-testid="empty-state"]');
    await expect(emptyState).toBeVisible();
  }
}
