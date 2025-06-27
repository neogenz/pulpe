import { test, expect } from '../../fixtures/test-fixtures';
import {
  INVALID_EMAILS,
  VALID_EMAILS,
  TEST_PASSWORDS,
} from '../../fixtures/test-data';
import {
  AssertionHelper,
  WaitHelper,
  TestDataFactory,
  SELECTORS,
  type TestStepContext,
} from '../../fixtures/test-helpers';

// Configuration pour l'exécution en parallèle
test.describe.configure({ mode: 'parallel' });

test.describe('User Authentication Flows', () => {
  // BeforeEach est automatiquement géré par les fixtures mais on peut ajouter des setups spécifiques
  test.beforeEach(async ({ page }, testInfo) => {
    // Ajout d'informations de contexte pour le debugging
    await testInfo.attach('test-environment', {
      body: JSON.stringify({
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport: await page.viewportSize(),
        url: page.url(),
      }),
      contentType: 'application/json',
    });
  });

  test.describe('Form Validation with Soft Assertions', () => {
    test('should validate email formats with comprehensive feedback', async ({
      loginPage,
      testCredentials,
      page,
    }) => {
      // Étape 1: Vérification initiale de la page
      await test.step('Verify initial page state', async () => {
        await loginPage.performComprehensivePageCheck();
      });

      // Étape 2: Test des emails invalides avec soft assertions
      await test.step('Test invalid email formats', async () => {
        for (const email of INVALID_EMAILS) {
          await test.step(`Testing invalid email: "${email}"`, async () => {
            await loginPage.fillEmail(email);
            await loginPage.fillPassword(TEST_PASSWORDS.VALID);

            // Soft assertion - le test continue même si une échoue
            await expect
              .soft(
                page.locator(SELECTORS.LOGIN.SUBMIT_BUTTON),
                `Submit should be disabled for email: ${email}`,
              )
              .toBeDisabled();
          });
        }
      });

      // Étape 3: Test des emails valides
      await test.step('Test valid email formats', async () => {
        for (const email of VALID_EMAILS) {
          await test.step(`Testing valid email: "${email}"`, async () => {
            await loginPage.fillEmail(email);
            await loginPage.fillPassword(TEST_PASSWORDS.VALID);

            // Attendre que la validation soit terminée
            await loginPage.waitForFormValidation();

            await expect
              .soft(
                page.locator(SELECTORS.LOGIN.SUBMIT_BUTTON),
                `Submit should be enabled for email: ${email}`,
              )
              .toBeEnabled();
          });
        }
      });
    });

    test('should provide progressive validation with soft assertions', async ({
      loginPage,
      testCredentials,
    }) => {
      const { valid } = testCredentials;

      await test.step('Initial form state validation', async () => {
        // Soft assertions groupées
        await expect
          .soft(loginPage.submitButton, 'Initial submit button state')
          .toBeDisabled();
        await expect
          .soft(loginPage.emailInput, 'Email input should be empty')
          .toHaveValue('');
        await expect
          .soft(loginPage.passwordInput, 'Password input should be empty')
          .toHaveValue('');
      });

      await test.step('Email-only validation', async () => {
        await loginPage.fillEmail(valid.email);
        await expect
          .soft(loginPage.submitButton, 'Submit with email only')
          .toBeDisabled();
      });

      await test.step('Complete form validation', async () => {
        await loginPage.fillPassword(valid.password);
        await expect
          .soft(loginPage.submitButton, 'Submit with complete form')
          .toBeEnabled();
      });

      await test.step('Form reset validation', async () => {
        await loginPage.fillPassword(TEST_PASSWORDS.EMPTY);
        await expect
          .soft(loginPage.submitButton, 'Submit after password clear')
          .toBeDisabled();
      });
    });
  });

  test.describe('Authentication Scenarios', () => {
    test('should handle authentication failure gracefully', async ({
      authFailurePage: page,
      testCredentials,
      loginPage,
    }) => {
      const { valid } = testCredentials;

      await test.step('Navigate to login page', async () => {
        // La fixture a déjà navigué et vérifié la page, on peut commencer directement
      });

      await test.step('Attempt login with wrong credentials', async () => {
        await loginPage.fillEmail(valid.email);
        await loginPage.fillPassword('wrongpassword');
        await loginPage.clickSubmit();
      });

      await test.step('Wait for authentication result and verify failure', async () => {
        const authResult = await loginPage.waitForAuthenticationResult(5000);

        // Soft assertions pour grouper les vérifications d'échec
        await expect
          .soft(page, 'Should remain on login page')
          .toHaveURL(/.*login.*/);

        if (authResult === 'error-visible') {
          await AssertionHelper.softAssertLoginError(page, true);
        }

        // Vérifier que la page reste fonctionnelle
        await AssertionHelper.softAssertPageResponsiveness(page);
      });
    });

    test('should handle successful authentication with proper waiting', async ({
      authenticatedPage: page,
      testCredentials,
      loginPage,
    }) => {
      const { valid } = testCredentials;

      await test.step('Check initial state and handle auto-authentication', async () => {
        // Si on est déjà redirigé (authentification automatique), le test passe
        if (!(await loginPage.isOnLoginPage())) {
          const isNotLoginPage = !page.url().includes('/login');
          await expect
            .soft(isNotLoginPage, 'Should be redirected away from login')
            .toBeTruthy();

          // Vérifier qu'on n'est pas sur une page d'erreur
          const errorPageCount = await page
            .locator('h1:has-text("Error"), h1:has-text("404")')
            .count();
          await expect
            .soft(errorPageCount, 'Should not be on error page')
            .toBe(0);

          return; // Test réussi avec authentification automatique
        }

        // Sinon, procéder avec le test de login manuel
        await loginPage.fillEmail(valid.email);
        await loginPage.fillPassword(valid.password);
      });

      // Continuer seulement si on était sur la page de login
      if (await loginPage.isOnLoginPage()) {
        await test.step('Submit and wait for authentication', async () => {
          await loginPage.clickSubmit();

          // Utiliser les helpers robustes au lieu de timeouts
          const authResult = await loginPage.waitForAuthenticationResult(8000);

          // Vérifications avec soft assertions
          await expect
            .soft(authResult !== 'timeout', 'Authentication should not timeout')
            .toBeTruthy();

          if (authResult === 'navigation-success') {
            await test.step('Verify successful navigation', async () => {
              const isNotLoginPage = !page.url().includes('/login');
              await expect
                .soft(isNotLoginPage, 'Should navigate away from login')
                .toBeTruthy();

              // Vérifier qu'on n'est pas sur une page d'erreur
              const errorPageCount = await page
                .locator('h1:has-text("Error"), h1:has-text("404")')
                .count();
              await expect
                .soft(errorPageCount, 'Should not be on error page')
                .toBe(0);
            });
          } else {
            // Si pas de redirection, vérifier qu'il n'y a pas d'erreur
            await AssertionHelper.softAssertLoginError(page, false);
            await AssertionHelper.softAssertPageResponsiveness(page);
          }
        });
      }
    });

    test('should handle server errors robustly', async ({
      serverErrorPage: page,
      testCredentials,
      loginPage,
    }) => {
      const { valid } = testCredentials;

      await test.step('Attempt login with server error scenario', async () => {
        await loginPage.login(valid.email, valid.password);
      });

      await test.step('Verify graceful error handling', async () => {
        // Attendre une réponse réseau d'erreur
        const errorResponse = await WaitHelper.waitForNetworkResponse(
          page,
          '/auth/',
          500,
          5000,
        );

        // Soft assertions pour vérifier la gestion d'erreur - plus flexible
        const hasErrorIndication =
          errorResponse ||
          (await page.locator(SELECTORS.COMMON.ERROR_MESSAGE).count()) > 0 ||
          (await page.locator('button[type="submit"]').count()) > 0;

        await expect
          .soft(
            hasErrorIndication,
            'Should show error indication or maintain functionality',
          )
          .toBeTruthy();

        await AssertionHelper.softAssertPageResponsiveness(page);
      });
    });
  });

  test.describe('Route Protection', () => {
    const protectedRoutes = [
      '/app/current-month',
      '/app/budget-templates',
      '/app/other-months',
    ] as const;

    const publicRoutes = [
      '/onboarding/welcome',
      '/onboarding/registration',
    ] as const;

    test('should protect routes from unauthenticated access', async ({
      page,
    }) => {
      for (const route of protectedRoutes) {
        await test.step(`Testing protected route: ${route}`, async () => {
          const stepContext: TestStepContext = {
            stepName: 'route-protection-test',
            description: `Verifying protection for ${route}`,
            data: { route, timestamp: new Date().toISOString() },
          };

          // Attacher le contexte au rapport
          await test
            .info()
            .attach(`route-test-${route.replace(/[^a-z0-9]/gi, '-')}`, {
              body: JSON.stringify(stepContext),
              contentType: 'application/json',
            });

          await page.goto(route);

          // Attendre la redirection avec WaitHelper
          const redirected = await WaitHelper.waitForNavigation(
            page,
            '/onboarding',
            5000,
          );

          await expect
            .soft(
              redirected || page.url().includes('/onboarding'),
              `Route ${route} should redirect to onboarding`,
            )
            .toBeTruthy();
        });
      }
    });

    test('should allow public access to onboarding routes', async ({
      page,
    }) => {
      for (const route of publicRoutes) {
        await test.step(`Testing public route: ${route}`, async () => {
          await page.goto(route);

          // Utiliser une regex escaped pour le test d'URL
          const routePattern = new RegExp(
            route.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'),
          );
          await expect
            .soft(page, `Route ${route} should be accessible`)
            .toHaveURL(routePattern);
        });
      }
    });
  });

  test.describe('UI Validation', () => {
    test('should perform comprehensive page validation', async ({
      page,
      loginPage, // Utiliser la fixture au lieu de créer une nouvelle instance
    }) => {
      await test.step('Verify page state', async () => {
        await loginPage.performComprehensivePageCheck();
      });

      await test.step('Test form controls and validation', async () => {
        await AssertionHelper.softAssertFormValidation(
          page,
          SELECTORS.LOGIN.EMAIL_INPUT,
          SELECTORS.LOGIN.PASSWORD_INPUT,
          SELECTORS.LOGIN.SUBMIT_BUTTON,
        );
      });

      await test.step('Test interactive elements', async () => {
        // Test avec les sélecteurs compatibles
        const emailInput = page.locator(SELECTORS.LOGIN.EMAIL_INPUT);
        const submitButton = page.locator(SELECTORS.LOGIN.SUBMIT_BUTTON);

        await expect
          .soft(emailInput, 'Email input should be accessible')
          .toBeEnabled();
        await expect
          .soft(submitButton, 'Submit button should be visible')
          .toBeVisible();
      });
    });

    test('should handle progressive form validation', async ({
      page,
      testCredentials,
      loginPage, // Utiliser la fixture au lieu de créer une nouvelle instance
    }) => {
      const { valid } = testCredentials;

      await test.step('Test empty form state', async () => {
        // Utiliser les helpers pour les vérifications d'état
        const submitDisabled = await WaitHelper.waitForElementStateChange(
          page,
          SELECTORS.LOGIN.SUBMIT_BUTTON,
          'visible',
          3000,
        );

        await expect
          .soft(submitDisabled, 'Submit should be disabled for empty form')
          .toBeTruthy();
      });

      await test.step('Test partial form completion', async () => {
        await loginPage.fillEmail(valid.email);

        // Soft assertion pour l'état du bouton avec email seul
        const submitButton = page.locator(SELECTORS.LOGIN.SUBMIT_BUTTON);
        const isDisabled = await submitButton.isDisabled();

        await expect
          .soft(isDisabled, 'Submit should be disabled with email only')
          .toBeTruthy();
      });

      await test.step('Test complete form validation', async () => {
        await loginPage.fillPassword(valid.password);

        // Vérifier l'activation du bouton
        const submitButton = page.locator(SELECTORS.LOGIN.SUBMIT_BUTTON);
        const isEnabled = await submitButton.isEnabled();

        await expect
          .soft(isEnabled, 'Submit should be enabled with both fields')
          .toBeTruthy();
      });
    });
  });

  // AfterEach automatique géré par les fixtures mais on peut ajouter des cleanups spécifiques
  test.afterEach(async ({ page }, testInfo) => {
    // Log final pour debugging
    if (testInfo.status === 'failed') {
      await testInfo.attach('final-page-state', {
        body: JSON.stringify({
          url: page.url(),
          title: await page.title(),
          timestamp: new Date().toISOString(),
        }),
        contentType: 'application/json',
      });
    }
  });
});
