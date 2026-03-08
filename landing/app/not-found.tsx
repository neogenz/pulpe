import Image from 'next/image'
import Link from 'next/link'
import { Container, Button, FadeIn, GrainOverlay } from '@/components/ui'
import { ANGULAR_APP_URL } from '@/lib/config'

export default function NotFound() {
  return (
    <div className="min-h-svh flex items-center justify-center bg-background relative overflow-hidden">
      <GrainOverlay />

      <Container className="text-center py-16 relative z-10">
        <FadeIn animateOnMount>
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <Image src="/icon-64.webp" alt="Pulpe" width={32} height={32} />
            <span className="font-bold text-xl text-text">Pulpe</span>
          </Link>
        </FadeIn>

        <FadeIn animateOnMount delay={0.1}>
          <p
            className="text-[8rem] md:text-[12rem] font-bold leading-none text-primary/15 select-none"
            aria-hidden="true"
          >
            404
          </p>
        </FadeIn>

        <FadeIn animateOnMount delay={0.2}>
          <h1 className="text-2xl md:text-3xl font-bold text-text -mt-6 md:-mt-10">
            Cette page n&apos;existe pas
          </h1>
          <p className="text-text-secondary mt-3 max-w-md mx-auto">
            L&apos;application Pulpe a déménagé. Tu peux y accéder directement sur son nouveau domaine.
          </p>
        </FadeIn>

        <FadeIn animateOnMount delay={0.3}>
          <nav className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button href={ANGULAR_APP_URL} glow>
              Accéder à l&apos;app
            </Button>
            <Button href="/" variant="secondary">
              Retour à l&apos;accueil
            </Button>
          </nav>
        </FadeIn>
      </Container>
    </div>
  )
}
