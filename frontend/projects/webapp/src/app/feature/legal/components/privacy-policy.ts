import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/routing';

@Component({
  selector: 'pulpe-privacy-policy',
  standalone: true,
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
            J'utilise <strong>PostHog</strong> (hébergé en Europe) pour analyser l'utilisation
            de l'application. Cet outil m'aide à :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Comprendre comment vous utilisez Pulpe</li>
            <li>Identifier et résoudre les problèmes techniques</li>
            <li>Améliorer l'expérience utilisateur</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Important :</strong> Vos montants financiers sont automatiquement masqués
            dans toutes les analyses. Je ne vois jamais vos données financières réelles
            dans les outils d'analyse.
          </p>
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
          <p class="text-body-large">Vous avez le droit de :</p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Accéder à vos données personnelles</li>
            <li>Corriger vos données</li>
            <li>Supprimer votre compte et toutes vos données</li>
            <li>Exporter vos données (format JSON)</li>
            <li>Vous opposer à certains traitements</li>
          </ul>
          <p class="text-body-large mt-4">
            Pour exercer ces droits, contactez-moi à :
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary">maxime.desogus@gmail.com</a>
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">10. Cookies</h2>
          <p class="text-body-large">
            J'utilise des cookies essentiels pour :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Maintenir votre session connectée</li>
            <li>Mémoriser vos préférences</li>
            <li>Assurer la sécurité</li>
          </ul>
          <p class="text-body-large mt-4">
            Ces cookies sont nécessaires au fonctionnement du service et ne peuvent
            pas être désactivés.
          </p>
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

  currentDate = new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
