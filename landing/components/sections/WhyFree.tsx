import { Card, FadeIn, Section } from "@/components/ui";
import { ANGULAR_APP_URL } from "@/lib/config";
import { Code2, Globe, Shield } from "lucide-react";

const TRUST_BADGES = [
  {
    icon: Shield,
    label: "Montants protégés",
    description: "Tes montants sont chiffrés et inaccessibles, même par moi.",
  },
  {
    icon: Globe,
    label: "Hébergé en Europe",
    description: "Données et analytics hébergés en UE.",
  },
  {
    icon: Code2,
    label: "Open Source",
    description: "Code ouvert, vérifiable par tous.",
  },
] as const;

const REASONS = [
  {
    title: "Un projet né d'un vrai besoin",
    text: "J'ai créé Pulpe parce que j'en avais marre de galérer à suivre mon budget sur mobile. Ça m'aide beaucoup au quotidien, quelques amis aussi — je me dis que ça peut aider d'autres personnes.",
  },
  {
    title: "Gratuit et open source",
    text: "Pas de publicité, pas d'abonnement caché. Un projet personnel développé par passion.",
  },
  {
    title: "Tes données sont protégées",
    text: "Données hébergés en Europe, tes montants sont protégés par chiffrement et contrôle d'accès. Seul toi peut y avoir accès et lire, même pas moi.",
  },
] as const;

export function WhyFree() {
  return (
    <Section background="grain" id="why-free">
      <div className="max-w-3xl mx-auto">
        <FadeIn variant="blur">
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-12">
            Pourquoi Pulpe est gratuit
          </h2>
        </FadeIn>

        {/* Trust badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {TRUST_BADGES.map((badge, index) => (
            <FadeIn key={badge.label} variant="blur" delay={index * 0.1}>
              <Card
                variant="organic"
                className="h-full flex flex-col items-center text-center p-5 lg:p-6"
              >
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10 mb-3">
                  <badge.icon
                    className="w-5 h-5 text-primary"
                    strokeWidth={1.5}
                  />
                </div>
                <span className="text-sm font-semibold text-text mb-1">
                  {badge.label}
                </span>
                <span className="text-xs text-text-secondary">
                  {badge.description}
                </span>
              </Card>
            </FadeIn>
          ))}
        </div>

        {/* Reasons */}
        <div className="space-y-8 text-text-secondary">
          {REASONS.map((reason, index) => (
            <FadeIn key={reason.title} variant="blur" delay={0.3 + index * 0.1}>
              <div className="border-l-2 border-primary/20 pl-6">
                <h3 className="font-semibold text-text mb-2">{reason.title}</h3>
                <p className="leading-relaxed">{reason.text}</p>
              </div>
            </FadeIn>
          ))}

          <FadeIn variant="blur" delay={0.6}>
            <p className="font-semibold text-text pt-4">
              — Maxime, créateur de Pulpe
            </p>
          </FadeIn>
        </div>

        <FadeIn variant="blur" delay={0.7}>
          <div className="flex flex-wrap gap-2 justify-center mt-10 text-sm">
            <a
              href="https://github.com/neogenz/pulpe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline py-3 px-2"
            >
              Voir le code source
            </a>
            <a
              href={`${ANGULAR_APP_URL}/legal/cgu`}
              className="text-accent hover:underline py-3 px-2"
            >
              CGU
            </a>
            <a
              href={`${ANGULAR_APP_URL}/legal/confidentialite`}
              className="text-accent hover:underline py-3 px-2"
            >
              Confidentialité
            </a>
          </div>
        </FadeIn>
      </div>
    </Section>
  );
}
