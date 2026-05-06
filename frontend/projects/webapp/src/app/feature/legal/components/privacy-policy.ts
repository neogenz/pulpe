import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
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
          <h2 class="text-headline-medium mb-4">1. Introduction</h2>
          <p class="text-body-large">
            Je prends votre vie privée au sérieux. Cette politique explique
            comment je collecte, utilise et protège vos données personnelles
            dans le cadre du service Pulpe, accessible via l'application web et
            l'application iOS.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">2. Données collectées</h2>

          <h3 class="text-title-large mb-2 mt-4">
            Données que vous me fournissez :
          </h3>
          <ul class="list-disc pl-6 text-body-large">
            <li>Email et mot de passe (pour votre compte)</li>
            <li>
              Si vous vous inscrivez via Google : email, nom et photo de profil
              transmis par Google
            </li>
            <li>Informations financières (revenus, dépenses, épargne)</li>
            <li>Préférences et paramètres de l'application</li>
          </ul>

          <h3 class="text-title-large mb-2 mt-4">
            Données collectées automatiquement :
          </h3>
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
            <li>Communiquer des informations importantes sur le service</li>
            <li>Assurer la sécurité de votre compte</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">4. Outils d'analyse</h2>
          <p class="text-body-large">
            J'utilise <strong>PostHog</strong> (hébergé en Europe -
            eu.posthog.com) pour analyser l'utilisation de l'application. Cet
            outil m'aide à :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Comprendre comment vous utilisez Pulpe</li>
            <li>Identifier et résoudre les problèmes techniques</li>
            <li>Améliorer l'expérience utilisateur</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Données envoyées à PostHog :</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Identifiant utilisateur (UUID Supabase) et email</li>
            <li>Prénom (si renseigné lors de l'inscription)</li>
            <li>Préférences produit : devise, paramètres d'affichage</li>
            <li>
              Statut early-adopter (utilisateur ayant activé son compte avant
              une date de référence)
            </li>
            <li>Pages visitées et interactions (clics, navigation)</li>
            <li>Traces d'erreur techniques (sans contenu sensible)</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Données NON envoyées à PostHog :</strong>
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              Vos montants financiers — masqués automatiquement avant envoi,
              jamais transmis
            </li>
            <li>Mots de passe, tokens d'authentification</li>
            <li>Identifiants de transactions ou de catégories budgétaires</li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Enregistrement de sessions :</strong> PostHog peut
            enregistrer des sessions d'utilisation (replay des interactions)
            pour m'aider à comprendre et résoudre les problèmes techniques. Tous
            les champs de saisie sont automatiquement masqués.
          </p>
          <p class="text-body-large mt-4">
            <strong>Base légale :</strong> intérêt légitime (article 6.1.f du
            RGPD) — analytics produit nécessaires à l'amélioration du service,
            avec données minimisées et hébergement Europe.
          </p>
          <p class="text-body-large mt-4">
            <strong>Accord de traitement (DPA) :</strong> un Data Processing
            Agreement a été signé avec PostHog Inc., conforme à l'article 28 du
            RGPD. PostHog agit en tant que sous-traitant (processor) pour les
            données collectées via Pulpe.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">
            5. Infrastructure et hébergement
          </h2>
          <p class="text-body-large mb-4">
            Pulpe utilise plusieurs services cloud pour fonctionner :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              <strong>Supabase</strong> (Europe - Frankfurt) : Stockage de vos
              données
            </li>
            <li><strong>Railway</strong> (USA - Oregon) : Backend API</li>
            <li><strong>Vercel</strong> (CDN global) : Interface web</li>
            <li><strong>PostHog</strong> (Europe) : Analytics</li>
            <li>
              <strong>Cloudflare Turnstile</strong> : Vérification anti-bot
              utilisée uniquement en mode démo (aucun cookie stocké)
            </li>
            <li>
              <strong>Google</strong> (OAuth) : Connexion via votre compte
              Google (si vous choisissez cette méthode d'inscription)
            </li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Note :</strong> Vos données sont principalement stockées en
            Europe (Supabase). Le backend Railway ne fait que transiter les
            données sans stockage permanent.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">6. Sécurité</h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>Toutes les connexions sont chiffrées (HTTPS)</li>
            <li>
              Mots de passe hashés de manière sécurisée par Supabase (notre
              fournisseur d'authentification)
            </li>
            <li>Authentification JWT sécurisée</li>
            <li>
              Accès aux données limité par utilisateur (Row Level Security)
            </li>
            <li>Sauvegardes automatiques par Supabase</li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">7. Partage des données</h2>
          <p class="text-body-large">
            Je <strong>ne vends JAMAIS</strong> vos données personnelles.
          </p>
          <p class="text-body-large mt-4">
            Vos données transitent uniquement par les services mentionnés
            ci-dessus. Le code source est open source sur GitHub mais vos
            données restent privées.
          </p>
          <p class="text-body-large mt-4">
            Les services tiers listés (Supabase, Railway, Vercel, PostHog,
            Cloudflare, Google) agissent comme sous-traitants au sens de
            l'article 28 du RGPD. Un Data Processing Agreement (DPA) dédié a été
            signé avec PostHog Inc. Pour les autres sous-traitants, les
            engagements de traitement sont fournis via leurs conditions de
            service standard, conformément à l'article 28 du RGPD.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">8. Durée de conservation</h2>
          <ul class="list-disc pl-6 text-body-large">
            <li>Données de compte : Tant que votre compte est actif</li>
            <li>Données financières : Conservées avec votre compte</li>
            <li>Données d'analyse : Maximum 12 mois</li>
            <li>Après suppression du compte : Effacement sous 3 jours</li>
            <li>
              Données de session démo : Supprimées automatiquement après 24
              heures
            </li>
          </ul>
          <p class="text-body-large mt-4">
            <strong>Note sur PostHog :</strong> à ce jour, la suppression du
            compte côté Pulpe n'entraîne pas automatiquement la suppression du
            profil analytics chez PostHog. Pour exercer votre droit à
            l'effacement sur les données analytics, contactez-moi par email — je
            procéderai à la suppression manuelle via l'API PostHog (sous 7 jours
            ouvrés).
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">9. Vos droits (RGPD/LPD)</h2>
          <p class="text-body-large mb-4">
            <strong>Conformément au RGPD et à la LPD suisse</strong>, vous
            disposez des droits suivants :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>Droit d'accès à vos données personnelles</li>
            <li>Droit de rectification de vos données</li>
            <li>Droit à l'effacement (suppression du compte)</li>
            <li>Droit à la portabilité (export JSON)</li>
            <li>
              Droit d'opposition (article 21 RGPD) — vous pouvez vous opposer à
              tout traitement fondé sur l'intérêt légitime, notamment
              l'analytics
            </li>
          </ul>
          <p class="text-body-large mt-4">
            Pour exercer ces droits, contactez-moi à :
            <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
              >maxime.desogus@gmail.com</a
            >. Je m'engage à vous répondre dans un délai d'un mois
          </p>
          <p class="text-body-large mt-2">
            Je suis responsable du traitement de vos données dès la création de
            votre compte.
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
            <li>
              Activés automatiquement (base légale : intérêt légitime, article
              6.1.f du RGPD). Vous pouvez exercer votre droit d'opposition à
              tout moment via l'email de contact ci-dessous.
            </li>
            <li>
              Données identifiables (email, identifiant utilisateur, prénom) —
              voir section 4 pour le détail des données envoyées à PostHog
            </li>
            <li>
              Vous pouvez vous opposer à ces cookies en me contactant à
              <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
                >maxime.desogus@gmail.com</a
              >
            </li>
          </ul>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">11. Enfants</h2>
          <p class="text-body-large">
            Pulpe n'est pas destiné aux enfants de moins de 16 ans. Je ne
            collecte pas sciemment de données d'enfants.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">12. Modifications</h2>
          <p class="text-body-large">
            Cette politique peut être mise à jour occasionnellement. Les
            changements importants seront notifiés par email.
          </p>
        </section>

        <section class="mb-8">
          <h2 class="text-headline-medium mb-4">13. Contact</h2>
          <p class="text-body-large">
            Pour toute question sur vos données personnelles :
          </p>
          <ul class="list-disc pl-6 text-body-large">
            <li>
              Email :
              <a href="mailto:maxime.desogus@gmail.com" class="text-primary"
                >maxime.desogus@gmail.com</a
              >
            </li>
            <li>
              GitHub :
              <a
                href="https://github.com/neogenz/pulpe"
                class="text-primary"
                target="_blank"
                >Issues & Discussions</a
              >
            </li>
            <li>Localisation : Suisse</li>
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

  protected readonly currentDate = '6 mai 2026';
}
