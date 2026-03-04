import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Container, AccordionItem, Button } from '@/components/ui'
import { Header, Footer } from '@/components/sections'
import { angularUrl, GITHUB_URL, CONTACT_EMAIL } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Aide et questions fréquentes',
  description:
    'Tout ce que tu veux savoir sur Pulpe : gratuité, sécurité, modèles de budget, chiffrement de bout en bout. Réponses claires, sans jargon.',
  alternates: {
    canonical: '/support',
  },
}

const linkClass = 'text-primary font-medium hover:underline'
const DEMO_URL = angularUrl('/welcome', 'faq_demo')

interface FaqItem {
  question: string
  answer: ReactNode
  plainAnswer: string
}

const faqs: FaqItem[] = [
  {
    question: 'Pourquoi Pulpe est gratuit, et où est le piège ?',
    answer: (
      <>
        <p>
          Il n'y en a pas. Pulpe est un <strong>projet open source</strong> développé par une seule
          personne, sur son temps libre.
        </p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            <strong>Pas de version premium</strong> cachée derrière un paywall
          </li>
          <li>
            <strong>Pas de pub</strong>, jamais
          </li>
          <li>
            <strong>Pas de revente de données</strong> — tes finances ne regardent que toi
          </li>
          <li>
            Le{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              code source est public
            </a>{' '}
            : tu peux vérifier par toi-même
          </li>
        </ul>
        <p className="mt-3">
          L'objectif est simple : créer l'app budget que j'aurais voulu avoir. Et la partager.
        </p>
      </>
    ),
    plainAnswer:
      "Il n'y en a pas. Pulpe est un projet open source développé par une seule personne, sur son temps libre. Pas de version premium, pas de pub, pas de revente de données. Le code source est public sur GitHub. L'objectif est simple : créer l'app budget que j'aurais voulu avoir, et la partager.",
  },
  {
    question: 'Comment créer mon premier budget en moins de 5 minutes ?',
    answer: (
      <>
        <p>C'est rapide, promis :</p>
        <ol className="mt-3 space-y-1 list-decimal list-inside">
          <li>
            <strong>Crée ton compte</strong> sur l'app web ou depuis l'app iOS
          </li>
          <li>
            L'onboarding te demande tes <strong>revenus</strong> et tes{' '}
            <strong>dépenses fixes</strong> — quelques champs suffisent
          </li>
          <li>
            Pulpe génère automatiquement ton <strong>premier modèle de budget</strong>
          </li>
          <li>
            Tu arrives sur ton <strong>tableau de bord</strong> avec ta situation du mois
          </li>
        </ol>
        <p className="mt-3">
          Tu veux tester sans t'inscrire ?{' '}
          <a href={DEMO_URL} className={linkClass}>
            Essaie le mode démo
          </a>{' '}
          — c'est sans engagement.
        </p>
      </>
    ),
    plainAnswer:
      "Crée ton compte sur l'app web ou depuis l'app iOS. L'onboarding te demande tes revenus et tes dépenses fixes. Pulpe génère automatiquement ton premier modèle de budget et tu arrives sur ton tableau de bord avec ta situation du mois. Tu peux aussi essayer le mode démo sans inscription.",
  },
  {
    question: 'Comment Pulpe protège mes données financières ?',
    answer: (
      <>
        <p>
          Tes montants sont chiffrés en base de données avec <strong>AES-256-GCM</strong> — le même
          standard utilisé par les banques et les armées.
        </p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            <strong>Architecture split-key</strong> : le déchiffrement nécessite deux clés qui ne
            sont jamais stockées au même endroit — ton code PIN et une clé serveur. Même en cas de
            fuite de la base de données, tes montants restent illisibles.
          </li>
          <li>
            <strong>Pas de revente, pas de partage</strong> : tes données ne sortent jamais de ton
            compte
          </li>
          <li>
            <strong>Open source</strong> : le code de chiffrement est auditable par n'importe qui
            sur{' '}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
              GitHub
            </a>
          </li>
        </ul>
        <p className="mt-3">
          En clair : si quelqu'un accédait à la base de données, il ne verrait que du charabia.
        </p>
      </>
    ),
    plainAnswer:
      "Tes montants sont chiffrés en base de données avec AES-256-GCM. Pulpe utilise une architecture split-key : le déchiffrement nécessite deux clés qui ne sont jamais stockées au même endroit — ton code PIN et une clé serveur. Même en cas de fuite de la base de données, tes montants restent illisibles. Le code est open source et auditable sur GitHub.",
  },
  {
    question: "Comment retrouver mes données entre le web et l'iPhone ?",
    answer: (
      <>
        <p>
          Tes données sont <strong>synchronisées automatiquement</strong> entre l'app web et l'app
          iOS.
        </p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            Connecte-toi avec le <strong>même compte</strong> sur les deux plateformes
          </li>
          <li>
            Toute modification est <strong>visible partout en temps réel</strong>
          </li>
          <li>
            Ton <strong>PIN de chiffrement</strong> est le même — tu le configures une fois par
            appareil
          </li>
        </ul>
        <p className="mt-3">
          Tu peux commencer sur le web le matin et continuer sur ton iPhone dans le bus.
        </p>
      </>
    ),
    plainAnswer:
      "Tes données sont synchronisées automatiquement entre l'app web et l'app iOS. Connecte-toi avec le même compte sur les deux plateformes. Toute modification est visible partout en temps réel. Tu configures ton PIN de chiffrement une fois par appareil.",
  },
  {
    question: 'À quoi servent les modèles de budget ?',
    answer: (
      <>
        <p>
          Un modèle, c'est une <strong>structure de mois type</strong> que tu peux réutiliser :
        </p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            Tes <strong>revenus récurrents</strong> (salaire, etc.)
          </li>
          <li>
            Tes <strong>dépenses fixes</strong> : loyer, assurances, abonnements...
          </li>
          <li>
            Tes <strong>prévisions d'épargne</strong>
          </li>
        </ul>
        <p className="mt-3">
          Chaque mois, tu <strong>génères un budget à partir de ton modèle</strong> en un tap.
          Ensuite, tu ajustes si besoin. Tu ne repars jamais de zéro.
        </p>
        <p className="mt-3">
          Si ta situation évolue, tu mets à jour ton modèle et les mois futurs suivent.
        </p>
      </>
    ),
    plainAnswer:
      "Un modèle est une structure de mois type réutilisable : revenus récurrents, dépenses fixes, prévisions d'épargne. Chaque mois, tu génères un budget à partir de ton modèle en un tap, puis tu ajustes si besoin. Tu ne repars jamais de zéro. Si ta situation évolue, tu mets à jour ton modèle et les mois futurs suivent.",
  },
  {
    question: 'Quelle est la différence entre une dépense récurrente et une dépense prévue ?',
    answer: (
      <>
        <p>C'est une question de fréquence :</p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            <strong>Récurrent</strong> = ce qui revient <strong>chaque mois</strong>, de manière
            fixe. Ton loyer, ton abo Netflix, ton assurance maladie.
          </li>
          <li>
            <strong>Prévu</strong> = une dépense <strong>ponctuelle</strong> que tu anticipes. Des
            vacances, un achat spécifique, un cadeau d'anniversaire.
          </li>
        </ul>
        <p className="mt-3">
          Les récurrents vivent dans ton modèle et se répètent automatiquement. Les prévus, tu les
          ajoutes au mois concerné. L'idée : <strong>anticiper plutôt que subir</strong>.
        </p>
      </>
    ),
    plainAnswer:
      "Récurrent désigne ce qui revient chaque mois de manière fixe (loyer, abonnements, assurances). Prévu désigne une dépense ponctuelle que tu anticipes (vacances, achat spécifique). Les récurrents se répètent automatiquement via ton modèle. Les prévus s'ajoutent au mois concerné. L'idée est d'anticiper plutôt que subir.",
  },
  {
    question: "J'utilise déjà Excel pour mon budget — pourquoi changer ?",
    answer: (
      <>
        <p>Excel fait le travail... jusqu'au jour où ça devient pénible :</p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            <strong>Formules cassées</strong> quand tu copies un onglet d'un mois à l'autre
          </li>
          <li>
            <strong>Pas de vue globale</strong> : tu ne vois pas ta trajectoire sur l'année en un
            clin d'œil
          </li>
          <li>
            <strong>Saisie fastidieuse</strong>, surtout sur mobile
          </li>
          <li>
            <strong>Aucune synchro</strong> entre tes appareils
          </li>
        </ul>
        <p className="mt-3">
          Pulpe reprend ce que tu fais déjà — <strong>prévisions, suivi, ajustements</strong> — mais
          sans la friction : modèles réutilisables, report automatique du solde, et accès web +
          iPhone toujours synchronisé.
        </p>
        <p className="mt-3">
          Et tes données restent chiffrées, ce qu'un fichier Excel sur Google Drive ne fait pas.
        </p>
      </>
    ),
    plainAnswer:
      "Excel fonctionne, mais les formules cassent, il n'y a pas de vue globale, la saisie mobile est pénible et il n'y a pas de synchro entre appareils. Pulpe reprend le même principe — prévisions, suivi, ajustements — mais avec des modèles réutilisables, un report automatique du solde, et un accès web + iPhone toujours synchronisé. En prime, tes données sont chiffrées de bout en bout.",
  },
  {
    question: 'Pourquoi Pulpe ne se connecte pas à ma banque ?',
    answer: (
      <>
        <p>
          C'est un <strong>choix délibéré</strong>, pas une limitation technique.
        </p>
        <ul className="mt-3 space-y-1 list-disc list-inside">
          <li>
            La synchro bancaire crée une <strong>dépendance à des services tiers</strong> qui
            accèdent à tes identifiants bancaires
          </li>
          <li>
            Ces services sont <strong>souvent payants</strong> — ce qui obligerait à rendre Pulpe
            payant aussi
          </li>
          <li>
            La saisie manuelle te pousse à <strong>rester conscient de tes dépenses</strong>
          </li>
        </ul>
        <p className="mt-3">
          C'est l'un des principes fondamentaux de Pulpe :{' '}
          <strong>anticiper plutôt que réagir</strong>. En pratique, ça prend quelques secondes par
          transaction.
        </p>
      </>
    ),
    plainAnswer:
      "C'est un choix délibéré. La synchro bancaire crée une dépendance à des services tiers qui accèdent à tes identifiants, et ces services sont souvent payants. La saisie manuelle te pousse à rester conscient de tes dépenses. C'est le principe fondamental de Pulpe : anticiper plutôt que réagir.",
  },
  {
    question: 'Qui développe Pulpe ?',
    answer: (
      <>
        <p>
          <strong>Maxime</strong>, développeur basé en Suisse. Pulpe est né d'une frustration
          personnelle : aucune app budget n'était à la fois{' '}
          <strong>simple, respectueuse de la vie privée, et pensée pour anticiper</strong>.
        </p>
        <p className="mt-3">
          C'est un <strong>projet solo et open source</strong>. Pas de startup, pas d'investisseurs,
          pas de pression commerciale. Juste une app construite pour résoudre un vrai problème.
        </p>
        <p className="mt-3">
          Tu peux suivre l'avancée du projet sur{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            GitHub
          </a>
          , ou m'écrire directement à{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </>
    ),
    plainAnswer:
      "Maxime, développeur basé en Suisse. Pulpe est né d'une frustration personnelle : aucune app budget n'était à la fois simple, respectueuse de la vie privée, et pensée pour anticiper. C'est un projet solo et open source, sans startup ni investisseurs.",
  },
  {
    question: 'Comment supprimer mon compte et mes données ?',
    answer: (
      <>
        <p>
          Tu gardes le <strong>contrôle total</strong> :
        </p>
        <ol className="mt-3 space-y-1 list-decimal list-inside">
          <li>
            Va dans les <strong>paramètres</strong> de l'app
          </li>
          <li>
            Choisis <strong>« Supprimer mon compte »</strong>
          </li>
          <li>
            Tu as <strong>3 jours pour changer d'avis</strong> — la suppression n'est pas immédiate
          </li>
          <li>
            Passé ce délai, <strong>toutes tes données sont définitivement effacées</strong>
          </li>
        </ol>
        <p className="mt-3">Rien n'est conservé. Zéro trace. C'est la promesse zero-knowledge.</p>
      </>
    ),
    plainAnswer:
      "Va dans les paramètres de l'app et choisis Supprimer mon compte. Tu as 3 jours pour changer d'avis. Passé ce délai, toutes tes données sont définitivement effacées. Rien n'est conservé.",
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
      text: faq.plainAnswer,
    },
  })),
}

const faqJsonLdString = JSON.stringify(faqJsonLd).replace(/</g, '\\u003c')

export default function SupportPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: faqJsonLdString }}
      />

      <Header />

      <main className="pt-32 pb-16 md:pb-24">
        <Container>
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold text-text mb-4">
              Tout ce que tu veux savoir sur Pulpe
            </h1>
            <p className="text-text-secondary text-lg mb-12">
              Tu as une question ? Tu es probablement au bon endroit. Et si la réponse n'y est pas,
              écris-moi — je réponds personnellement.
            </p>

            <section aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="sr-only">
                Questions fréquentes
              </h2>

              <div className="space-y-3">
                {faqs.map((faq) => (
                  <AccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
                ))}
              </div>
            </section>

            <section aria-labelledby="contact-heading" className="mt-16">
              <h2 id="contact-heading" className="text-xl font-semibold text-text mb-4">
                Toujours une question ?
              </h2>
              <p className="text-text-secondary leading-relaxed">
                Pas de chatbot, pas de ticket #48291. Écris-moi directement, je réponds
                personnellement.
              </p>
              <div className="mt-4 space-y-2 text-text-secondary leading-relaxed">
                <p>
                  <strong className="text-text">Email :</strong>{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
                <p>
                  <strong className="text-text">Bug ou suggestion ?</strong> Ouvre une issue sur{' '}
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    GitHub
                  </a>
                </p>
              </div>
            </section>

            <section className="mt-20 text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-text mb-3">
                Prêt à voir clair dans tes finances ?
              </h2>
              <p className="text-text-secondary mb-8">
                Gratuit, open source, et respectueux de ta vie privée.
              </p>
              <Button href={angularUrl('/signup', 'support_faq_cta')}>
                Commencer gratuitement
              </Button>
            </section>
          </div>
        </Container>
      </main>

      <Footer />
    </>
  )
}
