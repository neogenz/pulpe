import type { Metadata } from 'next'
import Link from 'next/link'
import { Container, AccordionItem } from '@/components/ui'
import { Header, Footer } from '@/components/sections'

export const metadata: Metadata = {
  title: 'Support',
  description: 'Questions fréquentes et contact pour Pulpe, ton app budget simple.',
  alternates: {
    canonical: '/support',
  },
}

const faqs = [
  {
    question: 'Pulpe est vraiment gratuit ?',
    answer:
      "Oui, Pulpe est 100% gratuit et open source. Pas de frais cachés, pas de version premium, pas de publicité. Le code source est disponible sur GitHub.",
  },
  {
    question: 'Comment commencer à utiliser Pulpe ?',
    answer:
      "Crée un compte sur l'app web ou télécharge l'app iOS. Tu peux commencer par créer ton premier budget mensuel et ajouter tes prévisions de dépenses et revenus.",
  },
  {
    question: 'Mes données sont bien protégées ?',
    answer:
      "Tes données sont chiffrées et stockées en sécurité. Elles ne sont jamais partagées ni vendues.",
  },
  {
    question: "Puis-je utiliser Pulpe sur plusieurs appareils ?",
    answer:
      "Oui, ton compte est synchronisé entre l'app web et l'app iOS. Connecte-toi avec le même compte pour retrouver tes données partout.",
  },
  {
    question: "Comment fonctionnent les modèles de budget ?",
    answer:
      "Les modèles te permettent de sauvegarder une configuration de budget (prévisions récurrentes, revenus, etc.) que tu peux réutiliser chaque mois. Tu gagnes du temps en évitant de tout recréer.",
  },
  {
    question: "C'est quoi la différence entre récurrent et prévu ?",
    answer:
      "Un récurrent revient chaque mois (loyer, abonnements). Un prévu, c'est une dépense ponctuelle que tu anticipes (vacances, achat spécifique).",
  },
  {
    question: "Comment supprimer mon compte ?",
    answer:
      "Tu peux supprimer ton compte depuis les paramètres de l'app. La suppression prend effet 3 jours après ta demande — tu peux changer d'avis entre-temps. Passé ce délai, toutes tes données seront effacées.",
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
}

export default function SupportPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      <Header />

      <main className="pt-32 pb-16 md:pb-24">
        <Container>
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-text mb-4">Support</h1>
            <p className="text-text-secondary text-lg mb-12">
              Retrouve ici les réponses aux questions les plus fréquentes. Si tu ne trouves pas ce que
              tu cherches, contacte-moi directement.
            </p>

            <section aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="text-xl font-semibold text-text mb-6">
                Questions fréquentes
              </h2>

              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} question={faq.question} answer={faq.answer} />
                ))}
              </div>
            </section>

            <section aria-labelledby="contact-heading" className="mt-16">
              <h2 id="contact-heading" className="text-xl font-semibold text-text mb-4">
                Contact
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Une question, quelque chose qui ne marche pas, ou une idée ?{' '}
                <a
                  href="mailto:maxime.desogus@gmail.com"
                  className="text-primary font-medium hover:underline"
                >
                  maxime.desogus@gmail.com
                </a>
              </p>
              <p className="text-text-secondary leading-relaxed mt-3">
                Tu peux aussi ouvrir une issue sur{' '}
                <a
                  href="https://github.com/neogenz/pulpe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-medium hover:underline"
                >
                  GitHub
                </a>
                .
              </p>
            </section>

            <div className="mt-16">
              <Link href="/" className="text-primary font-medium hover:underline">
                &larr; Retour à l'accueil
              </Link>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  )
}
