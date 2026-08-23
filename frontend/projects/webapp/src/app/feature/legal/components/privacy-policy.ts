import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-privacy-policy',

  imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto p-4 md:p-8">
      <article class="prose prose-lg max-w-none">
        <h1 class="text-display-small mb-8">
          {{ 'legal.privacyPolicyTitle' | transloco }}
        </h1>

        <p class="text-body-large text-on-surface-variant mb-6">
          {{ 'legal.lastUpdated' | transloco: { date: currentDate } }}
        </p>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.introduction.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.introduction.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.collected.title' | transloco }}
          </h2>

          <h3 class="text-title-large mb-2 mt-4">
            {{ 'legal.privacy.collected.providedTitle' | transloco }}
          </h3>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.collected.provided.email' | transloco }}</li>
            <li>{{ 'legal.privacy.collected.provided.google' | transloco }}</li>
            <li>
              {{ 'legal.privacy.collected.provided.financial' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.collected.provided.preferences' | transloco }}
            </li>
          </ul>

          <h3 class="text-title-large mb-2 mt-4">
            {{ 'legal.privacy.collected.automaticTitle' | transloco }}
          </h3>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.collected.automatic.pages' | transloco }}</li>
            <li>
              {{ 'legal.privacy.collected.automatic.duration' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.collected.automatic.errors' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.collected.automatic.device' | transloco }}
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.use.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.use.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.use.items.service' | transloco }}</li>
            <li>{{ 'legal.privacy.use.items.sync' | transloco }}</li>
            <li>{{ 'legal.privacy.use.items.improve' | transloco }}</li>
            <li>{{ 'legal.privacy.use.items.communication' | transloco }}</li>
            <li>{{ 'legal.privacy.use.items.security' | transloco }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.analytics.title' | transloco }}
          </h2>
          <p class="text-body-large">
            <strong>PostHog</strong>
            {{ 'legal.privacy.analytics.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              {{ 'legal.privacy.analytics.goals.understand' | transloco }}
            </li>
            <li>{{ 'legal.privacy.analytics.goals.resolve' | transloco }}</li>
            <li>{{ 'legal.privacy.analytics.goals.improve' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.analytics.sentTitle' | transloco
            }}</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.analytics.sent.user' | transloco }}</li>
            <li>{{ 'legal.privacy.analytics.sent.firstName' | transloco }}</li>
            <li>
              {{ 'legal.privacy.analytics.sent.preferences' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.analytics.sent.earlyAdopter' | transloco }}
            </li>
            <li>{{ 'legal.privacy.analytics.sent.pages' | transloco }}</li>
            <li>{{ 'legal.privacy.analytics.sent.errors' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.analytics.notSentTitle' | transloco
            }}</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.analytics.notSent.amounts' | transloco }}</li>
            <li>{{ 'legal.privacy.analytics.notSent.auth' | transloco }}</li>
            <li>
              {{ 'legal.privacy.analytics.notSent.recovery' | transloco }}
            </li>
            <li>{{ 'legal.privacy.analytics.notSent.content' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.analytics.replayTitle' | transloco
            }}</strong>
            {{ 'legal.privacy.analytics.replayBody' | transloco }}
          </p>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.analytics.legalBasisTitle' | transloco
            }}</strong>
            {{ 'legal.privacy.analytics.legalBasisBody' | transloco }}
          </p>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.analytics.dpaTitle' | transloco
            }}</strong>
            {{ 'legal.privacy.analytics.dpaBody' | transloco }}
          </p>
          <p class="text-body-large mt-4">
            {{ 'legal.privacy.analytics.optOutBefore' | transloco }}
            <strong>{{
              'legal.privacy.analytics.optOutSetting' | transloco
            }}</strong>
            {{ 'legal.privacy.analytics.optOutAfter' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.infrastructure.title' | transloco }}
          </h2>
          <p class="text-body-large mb-4">
            {{ 'legal.privacy.infrastructure.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              <strong>Supabase</strong>
              {{ 'legal.privacy.infrastructure.supabase' | transloco }}
            </li>
            <li>
              <strong>Railway</strong>
              {{ 'legal.privacy.infrastructure.railway' | transloco }}
            </li>
            <li>
              <strong>Vercel</strong>
              {{ 'legal.privacy.infrastructure.vercel' | transloco }}
            </li>
            <li>
              <strong>PostHog</strong>
              {{ 'legal.privacy.infrastructure.posthog' | transloco }}
            </li>
            <li>
              <strong>Cloudflare Turnstile</strong>
              {{ 'legal.privacy.infrastructure.cloudflare' | transloco }}
            </li>
            <li>
              <strong>Google</strong>
              {{ 'legal.privacy.infrastructure.google' | transloco }}
            </li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.infrastructure.noteTitle' | transloco
            }}</strong>
            {{ 'legal.privacy.infrastructure.noteBody' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.security.title' | transloco }}
          </h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.security.items.https' | transloco }}</li>
            <li>{{ 'legal.privacy.security.items.passwords' | transloco }}</li>
            <li>{{ 'legal.privacy.security.items.jwt' | transloco }}</li>
            <li>{{ 'legal.privacy.security.items.rls' | transloco }}</li>
            <li>{{ 'legal.privacy.security.items.backups' | transloco }}</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.sharing.title' | transloco }}
          </h2>
          <p class="text-body-large">
            <strong>{{ 'legal.privacy.sharing.neverSell' | transloco }}</strong>
          </p>
          <p class="text-body-large mt-4">
            {{ 'legal.privacy.sharing.privateBody' | transloco }}
          </p>
          <p class="text-body-large mt-4">
            {{ 'legal.privacy.sharing.processors' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.retention.title' | transloco }}
          </h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.retention.items.account' | transloco }}</li>
            <li>{{ 'legal.privacy.retention.items.financial' | transloco }}</li>
            <li>{{ 'legal.privacy.retention.items.analytics' | transloco }}</li>
            <li>{{ 'legal.privacy.retention.items.deletion' | transloco }}</li>
            <li>{{ 'legal.privacy.retention.items.demo' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.retention.analyticsDeletionTitle' | transloco
            }}</strong>
            {{ 'legal.privacy.retention.analyticsDeletionBody' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.rights.title' | transloco }}
          </h2>
          <p class="text-body-large mb-4">
            <strong>{{ 'legal.privacy.rights.introTitle' | transloco }}</strong>
            {{ 'legal.privacy.rights.introBody' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.rights.items.access' | transloco }}</li>
            <li>
              {{ 'legal.privacy.rights.items.rectification' | transloco }}
            </li>
            <li>{{ 'legal.privacy.rights.items.erasure' | transloco }}</li>
            <li>{{ 'legal.privacy.rights.items.portability' | transloco }}</li>
            <li>{{ 'legal.privacy.rights.items.objection' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            {{ 'legal.privacy.rights.contactBefore' | transloco }}
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
              >maxime.desogus@gmail.com</a
            >{{ 'legal.privacy.rights.contactAfter' | transloco }}
          </p>
          <p class="text-body-large mt-2">
            {{ 'legal.privacy.rights.controller' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.cookies.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.cookies.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>{{ 'legal.privacy.cookies.items.session' | transloco }}</li>
            <li>{{ 'legal.privacy.cookies.items.preferences' | transloco }}</li>
            <li>{{ 'legal.privacy.cookies.items.security' | transloco }}</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>{{
              'legal.privacy.cookies.trackersTitle' | transloco
            }}</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              {{ 'legal.privacy.cookies.trackers.automatic' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.cookies.trackers.identifiable' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.cookies.trackers.perDevice' | transloco }}
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.children.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.children.body' | transloco }}
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.changes.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.changes.body' | transloco }}
          </p>
        </section>

        <section class="mb-8" id="ai-assistants">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.aiAssistants.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.aiAssistants.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large mt-4">
            <li>{{ 'legal.privacy.aiAssistants.items.data' | transloco }}</li>
            <li>
              {{ 'legal.privacy.aiAssistants.items.purpose' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.aiAssistants.items.recipients' | transloco }}
            </li>
            <li>{{ 'legal.privacy.aiAssistants.items.key' | transloco }}</li>
            <li>
              {{ 'legal.privacy.aiAssistants.items.retention' | transloco }}
            </li>
            <li>
              {{ 'legal.privacy.aiAssistants.items.withdrawal' | transloco }}
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            {{ 'legal.privacy.contact.title' | transloco }}
          </h2>
          <p class="text-body-large">
            {{ 'legal.privacy.contact.intro' | transloco }}
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              {{ 'legal.privacy.contact.emailLabel' | transloco }}
              <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
                >maxime.desogus@gmail.com</a
              >
            </li>
            <li>
              {{ 'legal.privacy.contact.githubLabel' | transloco }}
              <a
                href="https://github.com/neogenz/pulpe"
                class="text-primary"
                target="_blank"
                rel="noopener noreferrer"
                >{{ 'legal.privacy.contact.githubText' | transloco }}</a
              >
            </li>
            <li>{{ 'legal.privacy.contact.location' | transloco }}</li>
          </ul>
        </section>

        <div class="mt-12 pt-8 border-t border-outline-variant">
          <p class="text-body-medium text-on-surface-variant text-center">
            {{ 'legal.privacyFooter' | transloco }}
            <a
              [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]"
              class="text-primary"
              >{{ 'legal.termsLink' | transloco }}</a
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
export default class PrivacyPolicyComponent {
  protected readonly ROUTES = ROUTES;
  readonly #transloco = inject(TranslocoService);

  protected readonly currentDate = new Intl.DateTimeFormat(
    this.#transloco.getActiveLang(),
    { dateStyle: 'long', timeZone: 'UTC' },
  ).format(new Date('2026-07-28T00:00:00Z'));
}
