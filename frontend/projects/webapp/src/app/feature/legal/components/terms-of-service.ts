import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-terms-of-service',
  imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto p-4 md:p-8">
      <article class="prose prose-lg max-w-none">
        <h1 class="text-display-small mb-8">
          {{ 'legal.termsOfServiceTitle' | transloco }}
        </h1>

        <p class="text-body-large text-on-surface-variant mb-6">
          {{ 'legal.lastUpdated' | transloco: { date: currentDate } }}
        </p>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.acceptance.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.acceptance.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.service.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.service.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.terms.service.items.plan' | transloco }}</li>
            <li>{{ 'legal.terms.service.items.track' | transloco }}</li>
            <li>{{ 'legal.terms.service.items.savings' | transloco }}</li>
            <li>{{ 'legal.terms.service.items.templates' | transloco }}</li>
            <li>{{ 'legal.terms.service.items.demo' | transloco }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.account.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.account.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.terms.account.items.password' | transloco }}</li>
            <li>{{ 'legal.terms.account.items.activity' | transloco }}</li>
            <li>{{ 'legal.terms.account.items.unauthorized' | transloco }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.data.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.data.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.terms.data.items.improve' | transloco }}</li>
            <li>{{ 'legal.terms.data.items.security' | transloco }}</li>
            <li>{{ 'legal.terms.data.items.bugs' | transloco }}</li>
            <li>{{ 'legal.terms.data.items.analytics' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{ 'legal.terms.data.analyticsLabel' | transloco }}</strong>
            {{ 'legal.terms.data.analyticsBody' | transloco }}
          </p>
        </section>

        <section class="mb-8" id="ai-assistants">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.aiAssistants.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.aiAssistants.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large mt-4">
            <li>
              {{ 'legal.terms.aiAssistants.items.authority' | transloco }}
            </li>
            <li>
              {{ 'legal.terms.aiAssistants.items.responsibility' | transloco }}
            </li>
            <li>{{ 'legal.terms.aiAssistants.items.editor' | transloco }}</li>
            <li>{{ 'legal.terms.aiAssistants.items.figures' | transloco }}</li>
            <li>
              {{ 'legal.terms.aiAssistants.items.revocation' | transloco }}
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.source.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.source.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.liability.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.liability.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              {{ 'legal.terms.liability.items.availability' | transloco }}
            </li>
            <li>{{ 'legal.terms.liability.items.errors' | transloco }}</li>
            <li>{{ 'legal.terms.liability.items.accuracy' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{ 'legal.terms.liability.warning' | transloco }}</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.terms.liability.items.advice' | transloco }}</li>
            <li>
              <strong>{{
                'legal.terms.liability.items.loss' | transloco
              }}</strong>
            </li>
            <li>{{ 'legal.terms.liability.items.decisions' | transloco }}</li>
            <li>{{ 'legal.terms.liability.items.advisor' | transloco }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.termination.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.termination.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.changes.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.changes.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.law.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.law.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.terms.contact.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.terms.contact.body' | transloco }}
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
              >maxime.desogus@gmail.com</a
            >
          </p>
        </section>

        <div class="mt-12 pt-8 border-t border-outline-variant">
          <p class="text-body-medium text-on-surface-variant text-center">
            {{ 'legal.termsFooter' | transloco }}
            <a
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]"
              class="text-primary"
              >{{ 'legal.privacyLink' | transloco }}</a
            >.
          </p>
        </div>
      </article>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100dvh;
      overflow-y: auto;
    }
  `,
})
export default class TermsOfServiceComponent {
  readonly #transloco = inject(TranslocoService);

  protected readonly ROUTES = ROUTES;

  protected readonly currentDate = new Intl.DateTimeFormat(
    this.#transloco.getActiveLang(),
    { dateStyle: 'long', timeZone: 'UTC' },
  ).format(new Date('2026-01-27T00:00:00Z'));
}
