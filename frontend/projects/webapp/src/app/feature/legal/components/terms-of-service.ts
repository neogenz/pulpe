import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-terms-of-service',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto p-4 md:p-8">

      <article class="prose prose-lg max-w-none">
        <h1 class="text-display-small mb-8">Conditions Générales d'Utilisation</h1>

        <p class="text-body-large text-on-surface-variant mb-6">
          Dernière mise à jour : {{ currentDate }}
        </p>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">1. Acceptation des conditions</h2>
          <p class="text-body-large">
            En créant un compte sur Pulpe, vous acceptez les présentes conditions d'utilisation.
            Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser mon service.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">2. Description du service</h2>
          <p class="text-body-large">
            Pulpe est une application de gestion budgétaire personnelle qui vous permet de :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Planifier vos budgets mensuels</li>
            <li>Suivre vos dépenses et revenus</li>
            <li>Gérer votre épargne</li>
            <li>Créer des modèles de budget réutilisables</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">3. Compte utilisateur</h2>
          <p class="text-body-large">
            Vous êtes responsable de :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Maintenir la confidentialité de votre mot de passe</li>
            <li>Toutes les activités effectuées avec votre compte</li>
            <li>M’informer immédiatement de tout accès non autorisé</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">4. Utilisation des données</h2>
          <p class="text-body-large">
            Je collecte et utilise vos données pour :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Fournir et améliorer le service</li>
            <li>Assurer la sécurité de votre compte</li>
            <li>Corriger les bugs et problèmes techniques</li>
            <li>Analyser l'utilisation pour améliorer l'expérience</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Important :</strong> J'utilise PostHog pour suivre
            l'utilisation de l'application. Cela inclut les pages visitées, les fonctionnalités
            utilisées et les erreurs rencontrées. Vos données financières sont toujours masquées
            dans ces analyses.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">5. Open Source et propriété</h2>
          <p class="text-body-large">
            Le code source de Pulpe est disponible sous licence MIT sur GitHub.
            Vous pouvez le consulter, le modifier et l'héberger vous-même.
            Cependant, vos données personnelles vous appartiennent et restent privées.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">6. Limitation de responsabilité</h2>
          <p class="text-body-large">
            Pulpe est un projet personnel maintenu sur mon temps libre.
            Le service est fourni "tel quel" et je ne peux pas garantir :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Une disponibilité continue du service</li>
            <li>L'absence totale d'erreurs ou de bugs</li>
            <li>L'exactitude des calculs (vérifiez toujours vos données)</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Avertissement important :</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Pulpe est un outil d'aide à la gestion budgétaire et ne constitue pas un conseil financier professionnel</li>
            <li><strong>Je décline toute responsabilité en cas de perte financière liée à l'utilisation de Pulpe</strong></li>
            <li>Vous êtes seul responsable de vos décisions financières</li>
            <li>En cas de doute, consultez un conseiller financier qualifié</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">7. Résiliation</h2>
          <p class="text-body-large">
            Vous pouvez supprimer votre compte à tout moment depuis les paramètres.
            Je me réserve le droit de suspendre ou supprimer votre compte en cas
            de violation de ces conditions ou d'utilisation abusive.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">8. Modifications des CGU</h2>
          <p class="text-body-large">
            Je peux modifier ces conditions si nécessaire. Les modifications
            importantes seront notifiées par email. L'utilisation continue du service
            après modification vaut acceptation des nouvelles conditions.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">9. Droit applicable</h2>
          <p class="text-body-large">
            Ces conditions sont régies par le droit suisse. Tout litige sera soumis
            aux tribunaux compétents de Genève, Suisse.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">10. Contact</h2>
          <p class="text-body-large">
            Pour toute question concernant ces conditions, contactez-moi à :
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary">maxime.desogus@gmail.com</a>
          </p>
        </section>

        <div class="mt-12 pt-8 border-t border-outline-variant">
          <p class="text-body-medium text-on-surface-variant text-center">
            En utilisant Pulpe, vous acceptez ces conditions d'utilisation ainsi que ma
            <a [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_PRIVACY]" class="text-primary">Politique de Confidentialité</a>.
          </p>
        </div>
      </article>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export default class TermsOfServiceComponent {
  protected readonly ROUTES = ROUTES;

  currentDate = new Date().toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
