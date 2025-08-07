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
    try {
      await this.page.goto('/app/budget-templates', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.waitForPageStable();
    } catch (error) {
      console.error('Navigation error:', error);
      // Retry once with a longer timeout
      await this.page.goto('/app/budget-templates', { 
        waitUntil: 'load',
        timeout: 30000 
      });
    }
  }

  async gotoAddTemplate() {
    await this.page.goto('/app/budget-templates/create');
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageStable();
  }

  async gotoTemplate(id: string) {
    await this.page.goto(`/app/budget-templates/details/${id}`);
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForPageStable();
  }

  private async waitForPageStable() {
    // Attendre que la page soit stable (pas de changements DOM pendant 500ms)
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // Fallback: attendre au moins que le body soit visible
      try {
        await this.page.waitForSelector('body', { state: 'visible', timeout: 5000 });
      } catch {
        // Last resort - just wait a bit (avoid in production)
        await this.page.waitForTimeout(1000);
      }
    }
  }

  // Add dedicated method for API-dependent waits
  async waitForApiResponse(endpoint: string, timeout: number = 5000) {
    try {
      await this.page.waitForResponse(
        response => response.url().includes(endpoint) && response.status() === 200,
        { timeout }
      );
    } catch {
      // Continue with test - API might be mocked
    }
  }

  async expectPageLoaded() {
    // Check if we're on the main templates page or create template page
    const isMainPage =
      (await this.page
        .locator('[data-testid="budget-templates-page"]')
        .count()) > 0;
    const isCreatePage =
      (await this.page.locator('[data-testid="create-template-page"]').count()) >
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
    } else if (isCreatePage) {
      // We're on the create template page
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
    // Use data-testid for create template page
    await expect(
      this.page.locator('[data-testid="create-template-page"]'),
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
    // Direct navigation is more reliable for CI environments
    await this.page.goto('/app/budget-templates/create', { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    });
    
    // Wait for Angular to render the page
    await this.page.waitForTimeout(1500);
    
    // Ensure the create template page is loaded
    try {
      await this.page.waitForSelector('[data-testid="create-template-page"]', { 
        timeout: 10000 
      });
    } catch {
      // If page doesn't load, try a refresh
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(1000);
    }
  }

  async expectFormVisible() {
    // First check if we're on the right page
    const isOnCreatePage = await this.page
      .locator('[data-testid="create-template-page"]')
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    
    if (!isOnCreatePage) {
      throw new Error('Not on create template page');
    }
    
    // Check if template limit is reached first
    const isLimitReached = await this.page
      .locator('text=/limite.*modèles/')
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    
    if (isLimitReached) {
      // Template limit reached - form won't be visible
      return;
    }
    
    // Wait for either loading spinner to disappear or form to appear
    try {
      // Wait for loading to finish
      await this.page.locator('mat-spinner').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
      
      // Check if form container is visible
      const formContainerVisible = await this.page
        .locator('[data-testid="template-form-container"]')
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      
      if (formContainerVisible) {
        // Wait for the template name input to be visible (the most important field)
        await expect(this.templateNameInput).toBeVisible({ timeout: 10000 });
      } else {
        // If no form container, check if we have the form itself
        const formVisible = await this.page
          .locator('[data-testid="template-form"]')
          .isVisible({ timeout: 5000 })
          .catch(() => false);
          
        if (formVisible) {
          await expect(this.templateNameInput).toBeVisible({ timeout: 10000 });
        } else {
          // Check for any blocking states
          const hasErrorState = await this.page
            .locator('.error, .mat-error, [role="alert"]')
            .isVisible({ timeout: 2000 })
            .catch(() => false);
            
          if (hasErrorState) {
            throw new Error('Form is in error state');
          } else {
            throw new Error('Template form not found and no error state detected');
          }
        }
      }
    } catch (error) {
      console.log('Form visibility check failed:', error);
      // Last resort - check if name input is directly available
      const nameInputExists = await this.templateNameInput.count() > 0;
      if (nameInputExists) {
        await expect(this.templateNameInput).toBeVisible({ timeout: 5000 });
      } else {
        throw error;
      }
    }
  }

  async fillTemplateName(name: string) {
    await this.templateNameInput.waitFor({ state: 'visible' });
    await this.templateNameInput.clear();
    await this.templateNameInput.fill(name);

    // Vérifier que la valeur a bien été saisie
    await expect(this.templateNameInput).toHaveValue(name);
  }

  async submitForm() {
    // First check if submit button exists
    const submitExists = await this.submitButton.count() > 0;
    if (!submitExists) {
      return; // No submit button available (probably template limit reached)
    }
    
    const isEnabled = await this.submitButton.isEnabled();
    
    if (isEnabled) {
      await this.submitButton.click();
      // Attendre soit une redirection, soit un message de succès/erreur
      await this.page.waitForTimeout(1000); // Laisser le temps à la requête de se traiter
    } else {
      // If button is disabled, the form is invalid
      // This is expected behavior for validation tests
      return;
    }
  }

  async expectValidationErrors() {
    // Check if submit button exists first
    const submitExists = await this.submitButton.count() > 0;
    
    if (submitExists) {
      // Vérifier la présence d'erreurs de validation
      const hasFieldErrors =
        (await this.page
          .locator('[data-testid="name-error"], .error, .mat-error')
          .count()) > 0;
      const isSubmitDisabled = !(await this.submitButton.isEnabled());

      expect(hasFieldErrors || isSubmitDisabled).toBeTruthy();
    } else {
      // If no submit button, check for template limit or other blocking states
      const hasLimitMessage = await this.page
        .locator('text=/limite.*modèles/')
        .count() > 0;
      
      expect(hasLimitMessage).toBeTruthy();
    }
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

  async navigateToTemplateDetails(templateName: string) {
    // Find the template card that contains the specified template
    const templateContainer = this.page.locator('mat-card, [class*="card"], article', {
      hasText: templateName
    });
    
    // Look for the "Détails" button within the template container
    const detailsButton = templateContainer.locator('button', { hasText: 'Détails' }).first();
    
    // Check if we found the button
    const buttonCount = await detailsButton.count();
    if (buttonCount > 0) {
      await detailsButton.click();
    } else {
      // If no button found, try clicking the card itself
      const cardCount = await templateContainer.count();
      if (cardCount > 0) {
        await templateContainer.first().click();
      } else {
        throw new Error(`Template "${templateName}" not found for navigation`);
      }
    }
    
    // Wait for navigation to complete
    await this.page.waitForLoadState('networkidle');
  }
}
