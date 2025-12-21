"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  Bell,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Smartphone,
  Check,
  ChevronRight,
} from "lucide-react";


// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseStyles =
    "inline-flex items-center gap-2 px-6 py-3 text-lg font-bold rounded-2xl border-3 border-black transition-all duration-150 hover-shift";

  const variants = {
    primary: "bg-pulpe-800 text-white shadow-brutal",
    secondary: "bg-tangerine-500 text-white shadow-brutal",
    outline: "bg-white text-sage-900 shadow-brutal-sm",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

function Card({
  children,
  className = "",
  accent = "pulpe",
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "pulpe" | "ocean" | "tangerine";
}) {
  const accents = {
    pulpe: "bg-pulpe-100",
    ocean: "bg-ocean-400/20",
    tangerine: "bg-tangerine-300/30",
  };

  return (
    <motion.div
      variants={fadeInUp}
      className={`rounded-2xl border-3 border-black ${accents[accent]} p-6 shadow-brutal ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ============================================================================
// SECTIONS
// ============================================================================

function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        isScrolled ? "bg-cream/95 shadow-brutal-sm backdrop-blur-sm" : ""
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2">
          <span className="text-3xl">🍊</span>
          <span className="text-2xl font-bold text-sage-900">Pulpe</span>
        </a>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="font-medium text-sage-700 transition-colors hover:text-pulpe-800"
          >
            Fonctionnalités
          </a>
          <a
            href="#how-it-works"
            className="font-medium text-sage-700 transition-colors hover:text-pulpe-800"
          >
            Comment ça marche
          </a>
          <Button variant="outline" className="!py-2 !text-base">
            Essayer la démo
          </Button>
        </nav>
      </div>
    </motion.header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-cream pt-24">
      {/* Background decorations */}
      <div className="absolute top-20 left-10 h-32 w-32 rounded-full bg-pulpe-300/40" />
      <div className="absolute right-20 bottom-40 h-48 w-48 rounded-full bg-tangerine-300/30" />
      <div className="absolute top-40 right-10 h-20 w-20 rounded-full bg-ocean-400/30" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid items-center gap-12 lg:grid-cols-2"
        >
          {/* Left: Copy */}
          <div className="space-y-8">
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-pulpe-200 px-4 py-2 text-sm font-semibold text-pulpe-900 shadow-brutal-sm"
            >
              <Sparkles className="h-4 w-4" />
              Made for Switzerland 🇨🇭
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-5xl leading-tight font-extrabold text-sage-900 md:text-6xl lg:text-7xl"
            >
              Arrêtez de{" "}
              <span className="relative inline-block">
                <span className="relative z-10">subir</span>
                <span className="absolute bottom-2 left-0 -z-0 h-4 w-full bg-tangerine-300" />
              </span>{" "}
              vos finances.
              <br />
              <span className="text-pulpe-800">Planifiez-les.</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="max-w-lg text-xl text-sage-500"
            >
              La puissance d'une planification annuelle combinée à la simplicité
              radicale d'une app mobile.{" "}
              <strong className="text-sage-700">
                Lissez vos grosses dépenses, ne les subissez plus.
              </strong>
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Button variant="primary">
                Essayer gratuitement
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button variant="outline">Voir la démo</Button>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="flex items-center gap-4 pt-4"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-10 w-10 rounded-full border-2 border-white bg-pulpe-300"
                  />
                ))}
              </div>
              <p className="text-sm text-sage-500">
                <strong className="text-sage-700">100+</strong> utilisateurs en
                Suisse
              </p>
            </motion.div>
          </div>

          {/* Right: App Mockup */}
          <motion.div variants={fadeInUp} className="relative">
            <div className="relative mx-auto max-w-sm">
              {/* Phone frame */}
              <div className="overflow-hidden rounded-[2.5rem] border-4 border-black bg-cream shadow-brutal-lg">
                  {/* Status bar */}
                  <div className="flex items-end justify-between bg-pulpe-800 px-6 pt-4 pb-3 text-xs text-white">
                    <span>9:41</span>
                    <span>●●● 📶 🔋</span>
                  </div>

                  {/* App content */}
                  <div className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-sage-500">Janvier 2025</p>
                        <p className="text-2xl font-bold text-sage-900">
                          Bonjour Max 👋
                        </p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulpe-200">
                        <span>🍊</span>
                      </div>
                    </div>

                    {/* Budget card */}
                    <div className="rounded-2xl border-2 border-black bg-pulpe-800 p-4 text-white shadow-brutal-sm">
                      <p className="text-sm opacity-80">Reste à dépenser</p>
                      <p className="text-3xl font-bold">CHF 1'847.50</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-pulpe-950">
                        <div
                          className="h-full rounded-full bg-pulpe-300"
                          style={{ width: "45%" }}
                        />
                      </div>
                      <p className="mt-2 text-xs opacity-80">
                        45% du budget utilisé
                      </p>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border-2 border-black bg-white p-3 shadow-brutal-sm">
                        <p className="text-xs text-sage-500">Revenus</p>
                        <p className="text-lg font-bold text-ocean-500">
                          +5'200
                        </p>
                      </div>
                      <div className="rounded-xl border-2 border-black bg-white p-3 shadow-brutal-sm">
                        <p className="text-xs text-sage-500">Dépenses</p>
                        <p className="text-lg font-bold text-tangerine-500">
                          -3'352
                        </p>
                      </div>
                    </div>
                  </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 z-10 rounded-xl border-2 border-black bg-pulpe-300 px-3 py-2 shadow-brutal-sm">
                <p className="text-sm font-bold">+CHF 500</p>
                <p className="text-xs text-sage-700">Rollover auto ✨</p>
              </div>

              <div className="absolute -bottom-4 -left-4 z-10 rounded-xl border-2 border-black bg-tangerine-300 px-3 py-2 shadow-brutal-sm">
                <p className="text-sm font-bold">Impôts lissés</p>
                <p className="text-xs text-sage-700">12 x CHF 250</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="bg-sage-100 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          {/* Section header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Le problème ? Vous devez{" "}
              <span className="text-tangerine-500">choisir</span>.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-sage-500">
              J'ai tout essayé. Et j'ai toujours fini frustré.
            </p>
          </motion.div>

          {/* Comparison cards */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Banking apps */}
            <motion.div
              variants={fadeInUp}
              className="rounded-2xl border-3 border-black bg-white p-8 shadow-brutal"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-black bg-ocean-400/20">
                <Smartphone className="h-8 w-8 text-ocean-500" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-sage-900">
                Les apps bancaires
              </h3>
              <p className="mb-6 text-lg text-tangerine-500">
                "Jolies mais à la vision trop courte"
              </p>
              <ul className="space-y-3">
                {[
                  "Interface moderne et agréable",
                  "Catégorisation automatique",
                  "Vue mois par mois uniquement",
                  "Impossible de planifier l'année",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${i < 2 ? "bg-pulpe-200 text-pulpe-800" : "bg-coral-500/20 text-coral-500"}`}
                    >
                      {i < 2 ? "✓" : "✗"}
                    </span>
                    <span className="text-sage-700">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Excel */}
            <motion.div
              variants={fadeInUp}
              className="rounded-2xl border-3 border-black bg-white p-8 shadow-brutal"
            >
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-black bg-forest-500/20">
                <CalendarDays className="h-8 w-8 text-forest-500" />
              </div>
              <h3 className="mb-2 text-2xl font-bold text-sage-900">
                Le fichier Excel
              </h3>
              <p className="mb-6 text-lg text-tangerine-500">
                "Puissant mais un cauchemar sur mobile"
              </p>
              <ul className="space-y-3">
                {[
                  "Flexibilité totale",
                  "Vision annuelle possible",
                  "Formules fragiles et complexes",
                  "Inutilisable en déplacement",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${i < 2 ? "bg-pulpe-200 text-pulpe-800" : "bg-coral-500/20 text-coral-500"}`}
                    >
                      {i < 2 ? "✓" : "✗"}
                    </span>
                    <span className="text-sage-700">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* The insight */}
          <motion.div
            variants={fadeInUp}
            className="relative mx-auto max-w-3xl rounded-2xl border-3 border-black bg-pulpe-800 p-8 text-center text-white shadow-brutal-lg md:p-12"
          >
            <p className="text-2xl leading-relaxed font-medium md:text-3xl">
              "Le vrai besoin n'était pas{" "}
              <span className="text-pulpe-300">un autre graphique</span>, mais
              la capacité de{" "}
              <span className="underline decoration-tangerine-300 decoration-4">
                lisser les grosses dépenses
              </span>{" "}
              comme les impôts ou les vacances."
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-full border-2 border-pulpe-300 bg-pulpe-700" />
              <div className="text-left">
                <p className="font-bold">Maxime</p>
                <p className="text-sm text-pulpe-300">Créateur de Pulpe</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Solution() {
  const features = [
    {
      icon: CalendarDays,
      title: "Lissez vos dépenses",
      description:
        "Répartissez impôts, vacances et assurances sur 12 mois. Plus jamais de mauvaises surprises.",
      accent: "tangerine" as const,
    },
    {
      icon: RefreshCcw,
      title: "Rollover automatique",
      description:
        "L'excédent d'un mois est reporté au suivant. Simple, transparent, automatique.",
      accent: "pulpe" as const,
    },
    {
      icon: Bell,
      title: "Alertes intelligentes",
      description:
        "Soyez prévenu à 80% et 90% de votre budget. Anticipez, ne subissez plus.",
      accent: "ocean" as const,
    },
  ];

  return (
    <section id="features" className="bg-cream py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border-2 border-black bg-pulpe-200 px-4 py-2 text-sm font-semibold text-pulpe-900 shadow-brutal-sm">
              <TrendingUp className="h-4 w-4" />
              La solution
            </div>
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Pulpe : le meilleur des{" "}
              <span className="text-pulpe-800">deux mondes</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-sage-500">
              La puissance d'Excel + la simplicité d'une app ={" "}
              <strong className="text-sage-700">la sérénité</strong>.
            </p>
          </motion.div>

          {/* Features grid */}
          <div className="grid gap-8 md:grid-cols-3">
            {features.map((feature, index) => (
              <Card key={index} accent={feature.accent}>
                <div
                  className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl border-2 border-black ${
                    feature.accent === "pulpe"
                      ? "bg-pulpe-300"
                      : feature.accent === "ocean"
                        ? "bg-ocean-400"
                        : "bg-tangerine-300"
                  }`}
                >
                  <feature.icon className="h-7 w-7 text-sage-900" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-sage-900">
                  {feature.title}
                </h3>
                <p className="text-sage-500">{feature.description}</p>
              </Card>
            ))}
          </div>

          {/* Key benefits */}
          <motion.div variants={fadeInUp} className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-4 rounded-xl border-2 border-black bg-white p-6 shadow-brutal-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pulpe-200">
                <Shield className="h-6 w-6 text-pulpe-800" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-bold text-sage-900">
                  Vos données restent en Suisse
                </h4>
                <p className="text-sage-500">
                  Hébergement sécurisé, conforme aux standards suisses.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 rounded-xl border-2 border-black bg-white p-6 shadow-brutal-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tangerine-300">
                <Sparkles className="h-6 w-6 text-sage-900" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-bold text-sage-900">
                  CHF uniquement
                </h4>
                <p className="text-sage-500">
                  Conçu pour le marché suisse. Pas de conversion, pas de
                  confusion.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Créez votre template",
      description:
        "Définissez vos revenus, dépenses fixes et objectifs d'épargne. Une fois pour toute l'année.",
    },
    {
      number: "02",
      title: "Planifiez en un clic",
      description:
        "Générez automatiquement 12 mois de budget. Ajustez mois par mois si besoin.",
    },
    {
      number: "03",
      title: "Vivez sereinement",
      description:
        "Suivez vos dépenses, recevez des alertes, et laissez le rollover faire le reste.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-sage-100 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-16"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Comment ça <span className="text-pulpe-800">marche</span> ?
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-sage-500">
              3 étapes pour reprendre le contrôle de vos finances.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group relative"
              >
                {/* Card */}
                <div className="flex h-full flex-col rounded-2xl border-3 border-black bg-white p-6 shadow-brutal transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-brutal-lg">
                  {/* Number badge */}
                  <div className="mb-4 flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-pulpe-800 text-lg font-extrabold text-white">
                      {step.number}
                    </span>
                    <h3 className="text-xl font-bold text-sage-900">
                      {step.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sage-500">{step.description}</p>

                  {/* Arrow connector (desktop only) */}
                  {index < 2 && (
                    <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-pulpe-200">
                        <ChevronRight className="h-4 w-4 text-pulpe-800" />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="bg-pulpe-800 py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-8"
        >
          <motion.div
            variants={fadeInUp}
            className="mx-auto inline-flex items-center gap-2 rounded-full border-2 border-pulpe-300 bg-pulpe-700 px-4 py-2 text-sm font-semibold text-pulpe-200"
          >
            <Sparkles className="h-4 w-4" />
            Prêt à commencer ?
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-4xl leading-tight font-extrabold text-white md:text-5xl lg:text-6xl"
          >
            Reprenez le contrôle.
            <br />
            <span className="text-pulpe-300">Retrouvez la sérénité.</span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="mx-auto max-w-xl text-xl text-pulpe-200"
          >
            Essayez Pulpe gratuitement pendant 14 jours. Sans carte bancaire.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
          >
            <Button
              variant="secondary"
              className="!bg-white !text-pulpe-800 hover:!bg-pulpe-100"
            >
              Essayer gratuitement
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="!border-pulpe-300 !bg-transparent !text-white hover:!bg-pulpe-700"
            >
              Voir la démo
            </Button>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap items-center justify-center gap-6 pt-8 text-sm text-pulpe-200"
          >
            {[
              "✓ 14 jours gratuits",
              "✓ Sans carte bancaire",
              "✓ Données en Suisse",
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {item}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-sage-900 py-12 text-sage-300">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍊</span>
            <span className="text-xl font-bold text-white">Pulpe</span>
          </div>

          <p className="text-sm">
            © 2025 Pulpe. Fait avec 🧡 en Suisse.
          </p>

          <div className="flex gap-6 text-sm">
            <a href="#" className="transition-colors hover:text-white">
              Confidentialité
            </a>
            <a href="#" className="transition-colors hover:text-white">
              CGU
            </a>
            <a href="#" className="transition-colors hover:text-white">
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  return (
    <div className="bg-cream">
      <Header />
      <main>
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
