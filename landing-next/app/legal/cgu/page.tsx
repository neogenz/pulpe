import Link from 'next/link'
import { Container } from '@/components/ui'

export const metadata = {
  title: "Conditions Générales d'Utilisation - Pulpe",
  description: "Conditions générales d'utilisation de Pulpe, l'application de gestion de budget.",
}

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="py-6 border-b border-text/5">
        <Container>
          <Link href="/landing" className="flex items-center gap-2 font-bold text-xl text-text">
            <img src="/landing/icon.png" alt="" aria-hidden="true" className="h-8 w-auto" />
            <span>Pulpe</span>
          </Link>
        </Container>
      </header>

      <main className="py-12 md:py-20">
        <Container>
          <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto">
            <h1>Conditions Générales d'Utilisation</h1>
            <p className="lead">Dernière mise à jour : janvier 2025</p>

            <h2>1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de l'application
              Pulpe, accessible via le site web pulpe.app et les applications mobiles associées.
            </p>

            <h2>2. Acceptation des conditions</h2>
            <p>
              En utilisant Pulpe, vous acceptez les présentes CGU dans leur intégralité.
              Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser l'application.
            </p>

            <h2>3. Description du service</h2>
            <p>
              Pulpe est une application gratuite de gestion de budget personnel permettant de :
            </p>
            <ul>
              <li>Suivre vos revenus et dépenses</li>
              <li>Créer et gérer des budgets</li>
              <li>Visualiser vos statistiques financières</li>
            </ul>

            <h2>4. Compte utilisateur</h2>
            <p>
              Pour utiliser Pulpe, vous devez créer un compte en fournissant une adresse email valide.
              Vous êtes responsable de la confidentialité de vos identifiants de connexion.
            </p>

            <h2>5. Données personnelles</h2>
            <p>
              Le traitement de vos données personnelles est décrit dans notre{' '}
              <Link href="/landing/legal/confidentialite">Politique de Confidentialité</Link>.
            </p>

            <h2>6. Propriété intellectuelle</h2>
            <p>
              Pulpe est un projet open source. Le code source est disponible sur{' '}
              <a href="https://github.com/maximedesogus/pulpe" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>.
            </p>

            <h2>7. Limitation de responsabilité</h2>
            <p>
              Pulpe est fourni "tel quel", sans garantie d'aucune sorte. L'utilisation de l'application
              se fait à vos propres risques. Les données financières saisies sont indicatives et ne
              constituent pas un conseil financier.
            </p>

            <h2>8. Modification des CGU</h2>
            <p>
              Nous nous réservons le droit de modifier ces CGU à tout moment. Les modifications
              entreront en vigueur dès leur publication sur cette page.
            </p>

            <h2>9. Contact</h2>
            <p>
              Pour toute question concernant ces CGU, contactez-nous à :{' '}
              <a href="mailto:maxime.desogus@gmail.com">maxime.desogus@gmail.com</a>
            </p>
          </article>
        </Container>
      </main>
    </div>
  )
}
