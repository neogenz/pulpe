import Link from 'next/link'
import { Container } from '@/components/ui'

export const metadata = {
  title: 'Politique de Confidentialité - Pulpe',
  description: 'Politique de confidentialité de Pulpe. Découvrez comment vos données sont protégées.',
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="py-6 border-b border-text/5">
        <Container>
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-text">
            <img src="/icon.png" alt="" aria-hidden="true" className="h-8 w-auto" />
            <span>Pulpe</span>
          </Link>
        </Container>
      </header>

      <main className="py-12 md:py-20">
        <Container>
          <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto">
            <h1>Politique de Confidentialité</h1>
            <p className="lead">Dernière mise à jour : janvier 2025</p>

            <h2>1. Introduction</h2>
            <p>
              Chez Pulpe, la protection de vos données personnelles est une priorité. Cette politique
              de confidentialité explique quelles données nous collectons, comment nous les utilisons
              et comment nous les protégeons.
            </p>

            <h2>2. Données collectées</h2>
            <h3>Données de compte</h3>
            <ul>
              <li>Adresse email (pour l'authentification)</li>
            </ul>

            <h3>Données financières</h3>
            <ul>
              <li>Budgets, revenus et dépenses que vous saisissez</li>
              <li>Catégories et libellés personnalisés</li>
            </ul>

            <h3>Données techniques</h3>
            <ul>
              <li>Données d'utilisation anonymisées via PostHog (hébergé en Europe)</li>
              <li>Journaux d'erreurs pour améliorer le service</li>
            </ul>

            <h2>3. Protection des données financières</h2>
            <p>
              <strong>Vos montants sont toujours masqués côté serveur.</strong> L'administrateur de
              Pulpe ne peut jamais voir vos chiffres réels. Seules des données agrégées et anonymisées
              sont utilisées pour améliorer le service.
            </p>

            <h2>4. Hébergement et sécurité</h2>
            <ul>
              <li>Données hébergées en Europe (Supabase)</li>
              <li>Analytics hébergés en Europe (PostHog)</li>
              <li>Connexions chiffrées (HTTPS)</li>
              <li>Authentification sécurisée via Supabase Auth</li>
            </ul>

            <h2>5. Partage des données</h2>
            <p>
              Nous ne vendons jamais vos données. Vos informations ne sont partagées avec aucun tiers,
              sauf obligation légale.
            </p>

            <h2>6. Vos droits</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement ("droit à l'oubli")</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition</li>
            </ul>
            <p>
              Pour exercer ces droits, contactez-nous à :{' '}
              <a href="mailto:maxime.desogus@gmail.com">maxime.desogus@gmail.com</a>
            </p>

            <h2>7. Cookies</h2>
            <p>
              Pulpe utilise uniquement des cookies essentiels au fonctionnement de l'application
              (authentification, préférences). Aucun cookie publicitaire n'est utilisé.
            </p>

            <h2>8. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. Les modifications seront publiées sur cette page
              avec la date de mise à jour.
            </p>

            <h2>9. Contact</h2>
            <p>
              Pour toute question concernant cette politique, contactez :{' '}
              <a href="mailto:maxime.desogus@gmail.com">maxime.desogus@gmail.com</a>
            </p>

            <p className="text-sm text-text-secondary mt-12">
              Voir aussi : <Link href="/legal/cgu">Conditions Générales d'Utilisation</Link>
            </p>
          </article>
        </Container>
      </main>
    </div>
  )
}
