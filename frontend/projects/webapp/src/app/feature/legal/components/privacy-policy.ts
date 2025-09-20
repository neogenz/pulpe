import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-privacy-policy',

  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-4xl mx-auto p-4 md:p-8">
      <article class="prose prose-lg max-w-none">
        <h1 class="text-display-small mb-8">Politique de Confidentialité</h1>

        <p class="text-body-large text-on-surface-variant mb-6">
          Dernière mise à jour : {{ currentDate }}
        </p>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">1. Introduction</h2>
          <p class="text-body-large">
            Je prends votre vie privée au sérieux. Cette politique explique
            comment je collecte, utilise et protège vos données personnelles
            dans le cadre du service Pulpe.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">2. Données collectées</h2>

          <h3 class="text-title-large mb-2 mt-4">Données que vous me fournissez :</h3>
          <ul class="list-disc pl-6 text-body-large">
            <li>Email et mot de passe (pour votre compte)</li>
            <li>Informations financières (revenus, dépenses, épargne)</li>
            <li>Préférences et paramètres de l'application</li>
          </ul>

          <h3 class="text-title-large mb-2 mt-4">Données collectées automatiquement :</h3>
          <ul class="list-disc pl-6 text-body-large">
            <li>Pages visitées et fonctionnalités utilisées</li>
            <li>Durée d'utilisation et fréquence</li>
            <li>Erreurs et problèmes techniques rencontrés</li>
            <li>Type d'appareil et navigateur</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">3. Utilisation des données</h2>
          <p class="text-body-large">J'utilise vos données pour :</p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Fournir le service de gestion budgétaire</li>
            <li>Sauvegarder et synchroniser vos budgets</li>
            <li>Améliorer l'application et corriger les bugs</li>
            <li>Vous envoyer des notifications importantes (optionnel)</li>
            <li>Assurer la sécurité de votre compte</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">4. Outils d'analyse</h2>
          <p class="text-body-large">
            J'utilise <strong>PostHog</strong> (hébergé en Europe - eu.posthog.com) pour analyser l'utilisation
            de l'application. Cet outil m'aide à :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Comprendre comment vous utilisez Pulpe</li>
            <li>Identifier et résoudre les problèmes techniques</li>
            <li>Améliorer l'expérience utilisateur</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Protection de vos données financières :</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Vos montants financiers sont automatiquement masqués dans toutes les analyses</li>
            <li>Les données sont pseudonymisées (votre identité n'est pas directement visible)</li>
            <li>Vos données financières ne sont <strong>jamais transmises à des tiers</strong></li>
            <li>Aucune utilisation commerciale de vos données</li>
            <li>Pas de publicité ciblée</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">5. Infrastructure et hébergement</h2>
          <p class="text-body-large mb-4">
            Pulpe utilise plusieurs services cloud pour fonctionner :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li><strong>Supabase</strong> (Europe - Frankfurt) : Stockage de vos données</li>
            <li><strong>Railway</strong> (USA - Oregon) : Backend API</li>
            <li><strong>Vercel</strong> (CDN global) : Interface web</li>
            <li><strong>PostHog</strong> (Europe) : Analytics</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Note :</strong> Vos données sont principalement stockées en Europe (Supabase).
            Le backend Railway ne fait que transiter les données sans stockage permanent.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">6. Sécurité</h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>Toutes les connexions sont chiffrées (HTTPS)</li>
            <li>Mots de passe hashés avec bcrypt</li>
            <li>Authentification JWT sécurisée</li>
            <li>Accès aux données limité par utilisateur (Row Level Security)</li>
            <li>Sauvegardes automatiques par Supabase</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">7. Partage des données</h2>
          <p class="text-body-large">
            Je <strong>ne vends JAMAIS</strong> vos données personnelles.
          </p>
          <p class="text-body-large mt-4">
            Vos données transitent uniquement par les services mentionnés ci-dessus.
            Le code source est open source sur GitHub mais vos données restent privées.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">8. Durée de conservation</h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>Données de compte : Tant que votre compte est actif</li>
            <li>Données financières : Conservées avec votre compte</li>
            <li>Données d'analyse : Maximum 12 mois</li>
            <li>Après suppression du compte : Effacement sous 30 jours</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">9. Vos droits (RGPD/LPD)</h2>
          <p class="text-body-large mb-4">
            <strong>Conformément au RGPD et à la LPD suisse</strong>, vous disposez des droits suivants :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Droit d'accès à vos données personnelles</li>
            <li>Droit de rectification de vos données</li>
            <li>Droit à l'effacement (suppression du compte)</li>
            <li>Droit à la portabilité (export JSON)</li>
            <li>Droit d'opposition à certains traitements</li>
            <li>Droit de retirer votre consentement à tout moment</li>
          </ul>
          <p class="text-body-large mt-4">
            Pour exercer ces droits, contactez-moi dans un délai de 30 jours à :
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary">maxime.desogus@gmail.com</a>
          </p>
          <p class="text-body-large mt-2">
            Je suis responsable du traitement de vos données dès la création de votre compte.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">10. Cookies et tracking</h2>
          <p class="text-body-large">
            J'utilise des cookies strictement nécessaires pour :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Maintenir votre session connectée (authentification)</li>
            <li>Mémoriser vos préférences d'interface</li>
            <li>Assurer la sécurité du service</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Cookies d'analyse (PostHog) :</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Activés uniquement après acceptation des CGU lors de l'inscription</li>
            <li>Données pseudonymisées (pas d'identification directe)</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">11. Enfants</h2>
          <p class="text-body-large">
            Pulpe n'est pas destiné aux enfants de moins de 16 ans. Je ne collecte
            pas sciemment de données d'enfants.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">12. Modifications</h2>
          <p class="text-body-large">
            Cette politique peut être mise à jour occasionnellement. Les changements
            importants seront notifiés par email.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">13. Contact</h2>
          <p class="text-body-large">
            Pour toute question sur vos données personnelles :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Email : <a href="mailto:maxime.desogus@gmail.com" class="text-primary">maxime.desogus@gmail.com</a></li>
            <li>GitHub : <a href="https://github.com/neogenz/pulpe" class="text-primary" target="_blank">Issues & Discussions</a></li>
            <li>Localisation : Suisse</li>
          </ul>
        </section>

        <div class="mt-12 pt-8 border-t border-outline-variant">
          <p class="text-body-medium text-on-surface-variant text-center">
            Cette politique fait partie intégrante de mes
            <a [routerLink]="['/', ROUTES.LEGAL, ROUTES.LEGAL_TERMS]" class="text-primary">Conditions d'Utilisation</a>.
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
export default class PrivacyPolicyComponent {
  protected readonly ROUTES = ROUTES;

  currentDate = new Date().toLocaleDateString('fr-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
