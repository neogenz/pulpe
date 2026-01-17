"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  RefreshCcw,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  Smartphone,
  Check,
  ChevronRight,
  Globe,
} from "lucide-react";


// ============================================================================
// ANIMATED COMPONENTS
// ============================================================================

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const buttonBounce = {
  rest: { scale: 1 },
  hover: {
    scale: 1.03,
    transition: { type: "spring", stiffness: 400, damping: 10 },
  },
  tap: { scale: 0.97 },
};

const APP_URL = "https://app.pulpe.ch/onboarding";

function Button({
  children,
  variant = "primary",
  className = "",
  href,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const baseStyles =
    "inline-flex items-center gap-2.5 px-7 py-3.5 text-lg font-bold rounded-2xl border-3 border-black cursor-pointer";

  const variants = {
    primary: "bg-pulpe-800 text-white shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-sm transition-all duration-150",
    secondary: "bg-tangerine-500 text-white shadow-brutal hover:shadow-brutal-lg hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-sm transition-all duration-150",
    outline: "bg-white text-sage-900 shadow-brutal-sm hover:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_#000] transition-all duration-150",
  };

  if (href) {
    return (
      <motion.a
        href={href}
        variants={buttonBounce}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        className={`${baseStyles} ${variants[variant]} ${className}`}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      variants={buttonBounce}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      className={`${baseStyles} ${variants[variant]} ${className}`}
      onClick={onClick}
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
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
      className={`rounded-2xl border-3 border-black ${accents[accent]} p-6 shadow-brutal transition-shadow duration-200 hover:shadow-brutal-lg ${className}`}
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
        <motion.a
          href="#"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2"
        >
          <img src="/icon.png" alt="Pulpe" className="h-8 w-auto" />
          <span className="text-2xl font-extrabold text-sage-900">Pulpe</span>
        </motion.a>
        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="font-semibold text-sage-700 transition-colors hover:text-pulpe-800"
          >
            Fonctionnalités
          </a>
          <a
            href="#how-it-works"
            className="font-semibold text-sage-700 transition-colors hover:text-pulpe-800"
          >
            Comment ça marche
          </a>
          <Button variant="outline" className="!py-2.5 !px-5 !text-base" href={APP_URL}>
            Essayer gratuitement
          </Button>
        </nav>
      </div>
    </motion.header>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-cream pt-24">
      {/* Background decorations - animated */}
      <motion.div
        animate={{
          y: [0, -20, 0],
          rotate: [0, 5, 0],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-10 h-32 w-32 rounded-full bg-pulpe-300/50 blur-sm"
      />
      <motion.div
        animate={{
          y: [0, -25, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute right-20 bottom-40 h-48 w-48 rounded-full bg-tangerine-300/40 blur-sm"
      />
      <motion.div
        animate={{
          y: [0, -15, 0],
          x: [0, 10, 0],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute top-40 right-10 h-20 w-20 rounded-full bg-ocean-400/40 blur-sm"
      />
      {/* Additional decorative elements */}
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute bottom-20 left-1/4 h-24 w-24 rounded-full bg-pulpe-200/40 blur-sm"
      />

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
              variants={fadeInScale}
              className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-pulpe-200 px-4 py-2 text-sm font-semibold text-pulpe-900 shadow-brutal-sm"
            >
              <Sparkles className="h-4 w-4" />
              Ton allié budget en Suisse 🇨🇭
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-5xl leading-[1.1] font-extrabold tracking-tight text-sage-900 md:text-6xl lg:text-7xl"
            >
              Planifie ton année.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10 text-pulpe-800">Profite</span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.4, ease: "easeOut" }}
                  className="absolute bottom-2 left-0 -z-0 h-4 w-full origin-left bg-tangerine-300"
                />
              </span>{" "}
              de ton mois.
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="max-w-lg text-xl leading-relaxed text-sage-600"
            >
              Fini le brouillard. Pulpe t'aide à voir loin pour dépenser l'esprit léger.{" "}
              <strong className="text-sage-800">
                Simple comme noter un achat, puissant comme prévoir ton année.
              </strong>
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col gap-4 sm:flex-row"
            >
              <Button variant="primary" href={APP_URL}>
                Commencer gratuitement
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button variant="outline" href="#how-it-works">
                Voir comment ça marche
              </Button>
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
                      <p className="text-sm text-sage-500">Janvier 2026</p>
                      <p className="text-2xl font-bold text-sage-900">
                        Salut Max 👋
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulpe-200">
                      <img src="/icon.png" alt="" className="h-6 w-auto" />
                    </div>
                  </div>

                  {/* Budget card */}
                  <div className="rounded-2xl border-2 border-black bg-pulpe-800 p-4 text-white shadow-brutal-sm">
                    <p className="text-sm opacity-80">
                      Ce qu'il te reste à dépenser
                    </p>
                    <p className="text-3xl font-bold">CHF 1'847.50</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-pulpe-950">
                      <div
                        className="h-full rounded-full bg-pulpe-300"
                        style={{ width: "45%" }}
                      />
                    </div>
                    <p className="mt-2 text-xs opacity-80">
                      Tu as utilisé 45% de ton budget
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

              {/* Floating badges with animation */}
              <motion.div
                initial={{ opacity: 0, x: 20, y: -20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1.2, type: "spring", stiffness: 100 }}
                className="absolute -top-4 -right-4 z-10 rounded-xl border-2 border-black bg-pulpe-300 px-3 py-2 shadow-brutal-sm"
              >
                <p className="text-sm font-bold">+CHF 500</p>
                <p className="text-xs text-sage-700">Report auto</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20, y: 20 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                transition={{ delay: 1.4, type: "spring", stiffness: 100 }}
                className="absolute -bottom-4 -left-4 z-10 rounded-xl border-2 border-black bg-tangerine-300 px-3 py-2 shadow-brutal-sm"
              >
                <p className="text-sm font-bold">Impôts lissés</p>
                <p className="text-xs text-sage-700">12 x CHF 250</p>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function PainPoints() {
  const painPoints = [
    {
      icon: CalendarDays,
      title: "L'angoisse",
      text: "Ce moment où tu découvres une dépense que tu avais oubliée. Trop tard pour anticiper.",
    },
    {
      icon: Smartphone,
      title: "L'abandon",
      text: "Tu voulais bien faire, mais ton outil est trop compliqué. Alors tu laisses tomber.",
    },
    {
      icon: TrendingUp,
      title: "Le doute",
      text: "Cette question qui revient : « Est-ce que je peux me le permettre ? » Sans jamais avoir la réponse.",
    },
  ];

  return (
    <section className="bg-sage-100 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Section header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Tu mérites{" "}
              <span className="text-tangerine-500">mieux que ça</span>
            </h2>
          </motion.div>

          {/* Pain points cards */}
          <div className="grid gap-6 md:grid-cols-3">
            {painPoints.map((pain, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
                className="group rounded-2xl border-3 border-black bg-white p-6 shadow-brutal transition-shadow duration-200 hover:shadow-brutal-lg"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-tangerine-300/40 transition-colors duration-200 group-hover:bg-tangerine-300/60">
                    <pain.icon className="h-6 w-6 text-tangerine-600" />
                  </div>
                  <h3 className="text-xl font-bold text-tangerine-600">{pain.title}</h3>
                </div>
                <p className="text-base leading-relaxed text-sage-600">{pain.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Transition text */}
          <motion.p
            variants={fadeInUp}
            className="text-center text-xl text-sage-500"
          >
            <strong className="text-pulpe-800">Pulpe</strong> existe pour que tu
            puisses enfin souffler.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

function Solution() {
  return (
    <section id="solution" className="bg-cream py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Vois <span className="text-pulpe-800">loin</span>.
              <br />
              Dépense <span className="text-tangerine-500">sereinement</span>.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-sage-500">
              Pulpe ne te demande pas de tout noter. Elle t'aide à anticiper ce
              qui compte : les grosses dépenses, les imprévus prévisibles, ton
              reste à vivre.{" "}
              <strong className="text-sage-700">
                Tu sais où tu en es. Tu respires.
              </strong>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: CalendarDays,
      title: "12 mois devant toi, zéro surprise",
      description:
        "Impôts, vacances, cadeaux — tout ce qui peut te surprendre est déjà là, visible. Tu anticipes au lieu de subir.",
      badge: "Clarté",
      accent: "pulpe" as const,
    },
    {
      icon: Sparkles,
      title: "Noter une dépense ? 5 secondes.",
      description:
        "Pas de catégories à choisir, pas de formulaire interminable. Tu notes, c'est fait. Ton budget reste à jour sans effort.",
      badge: "Légèreté",
      accent: "tangerine" as const,
    },
    {
      icon: Shield,
      title: "Tu vois venir, tu gères",
      description:
        "Chaque dépense prévue est là, à sa place. Tu sais ce qui arrive, tu sais ce qu'il te reste. C'est ça, le contrôle.",
      badge: "Contrôle",
      accent: "ocean" as const,
    },
    {
      icon: RefreshCcw,
      title: "Configure une fois, oublie ensuite",
      description:
        "Ton loyer, tes abonnements, tes charges — tu les rentres une fois. Pulpe s'occupe du reste, mois après mois.",
      badge: "Légèreté",
      accent: "pulpe" as const,
    },
  ];

  return (
    <section id="features" className="bg-sage-100 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Ce que Pulpe{" "}
              <span className="text-pulpe-800">change pour toi</span>
            </h2>
          </motion.div>

          {/* Features grid */}
          <div className="grid gap-8 md:grid-cols-2">
            {features.map((feature, index) => (
              <Card key={index} accent={feature.accent}>
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-black ${
                      feature.accent === "pulpe"
                        ? "bg-pulpe-300"
                        : feature.accent === "ocean"
                          ? "bg-ocean-400"
                          : "bg-tangerine-300"
                    }`}
                  >
                    <feature.icon className="h-7 w-7 text-sage-900" />
                  </div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-xl font-bold text-sage-900">
                        {feature.title}
                      </h3>
                      <span className="rounded-full bg-pulpe-800 px-2 py-0.5 text-xs font-semibold text-white">
                        {feature.badge}
                      </span>
                    </div>
                    <p className="text-sage-500">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Tes revenus",
      description: "Ce qui rentre chaque mois. Simple.",
    },
    {
      number: "02",
      title: "Tes charges fixes",
      description: "Loyer, abos, assurances — ce qui part tous les mois.",
    },
    {
      number: "03",
      title: "Ce qui arrive",
      description: "Vacances, impôts, projets — Pulpe t'aide à voir loin.",
    },
  ];

  return (
    <section id="how-it-works" className="bg-cream py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Commence en <span className="text-pulpe-800">3 minutes</span>
            </h2>
          </motion.div>

          {/* Steps */}
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -6, transition: { type: "spring", stiffness: 300 } }}
                className="group relative"
              >
                {/* Card */}
                <div className="flex h-full flex-col rounded-2xl border-3 border-black bg-white p-6 shadow-brutal transition-shadow duration-200 group-hover:shadow-brutal-lg">
                  {/* Number badge */}
                  <div className="mb-4 flex items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-pulpe-800 text-lg font-extrabold text-white transition-transform duration-200 group-hover:scale-110">
                      {step.number}
                    </span>
                    <h3 className="text-xl font-bold text-sage-900">
                      {step.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-sage-600 leading-relaxed">{step.description}</p>

                  {/* Arrow connector (desktop only) */}
                  {index < 2 && (
                    <div className="absolute -right-6 top-1/2 z-10 hidden -translate-y-1/2 md:block">
                      <motion.div
                        animate={{ x: [0, 6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        className="flex h-12 w-12 items-center justify-center rounded-full border-3 border-black bg-pulpe-200 shadow-brutal"
                      >
                        <ChevronRight className="h-7 w-7 text-pulpe-800" />
                      </motion.div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div variants={fadeInUp} className="text-center">
            <Button variant="primary" href={APP_URL}>
              Créer mon espace
              <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

const IOS_APP_URL = "#"; // TODO: Replace with App Store link

function Availability() {
  return (
    <section className="bg-sage-100 py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-12"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Disponible <span className="text-pulpe-800">partout</span>
            </h2>
            <p className="mx-auto max-w-xl text-lg text-sage-500">
              Sur ton téléphone, ta tablette ou ton ordinateur. Pulpe s'adapte à toi.
            </p>
          </motion.div>

          {/* Options grid */}
          <div className="grid gap-8 md:grid-cols-2">
            {/* Web App */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
              className="rounded-2xl border-3 border-black bg-white p-8 shadow-brutal transition-shadow duration-200 hover:shadow-brutal-lg"
            >
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-ocean-400">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-2 text-2xl font-bold text-sage-900">
                    Dans ton navigateur
                  </h3>
                  <p className="mb-4 text-sage-500">
                    Aucune installation. Ouvre Pulpe depuis Safari, Chrome ou n'importe quel navigateur sur ton téléphone. C'est instantané.
                  </p>
                  <Button variant="primary" href={APP_URL} className="!text-base !px-5 !py-2.5">
                    Ouvrir Pulpe
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* iOS App */}
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -4, transition: { type: "spring", stiffness: 300 } }}
              className="rounded-2xl border-3 border-black bg-white p-8 shadow-brutal transition-shadow duration-200 hover:shadow-brutal-lg"
            >
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-sage-900">
                  <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-sage-900">App iOS</h3>
                    <span className="rounded-full bg-pulpe-200 px-2.5 py-0.5 text-xs font-semibold text-pulpe-800">
                      Nouveau
                    </span>
                  </div>
                  <p className="mb-4 text-sage-500">
                    L'expérience native sur iPhone. Notifications, widget, et accès rapide depuis ton écran d'accueil.
                  </p>
                  <a
                    href={IOS_APP_URL}
                    className="inline-block transition-transform hover:scale-105"
                  >
                    <img
                      src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                      alt="Télécharger sur l'App Store"
                      className="h-11"
                    />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Android coming soon */}
          <motion.div variants={fadeInUp} className="text-center">
            <div className="inline-flex items-center gap-3 rounded-full border-2 border-sage-300 bg-sage-50 px-5 py-3">
              <Smartphone className="h-5 w-5 text-sage-500" />
              <span className="text-sage-600">
                <strong className="text-sage-700">Android</strong> arrive bientôt
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function WhyFree() {
  return (
    <section className="bg-cream py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-8"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="text-center">
            <h2 className="mb-4 text-4xl font-extrabold text-sage-900 md:text-5xl">
              Pourquoi Pulpe est{" "}
              <span className="text-pulpe-800">gratuit</span>
            </h2>
          </motion.div>

          {/* Content card */}
          <motion.div
            variants={fadeInUp}
            className="rounded-2xl border-3 border-black bg-white p-8 shadow-brutal md:p-12"
          >
            <div className="space-y-6 text-lg text-sage-700">
              <div>
                <h3 className="mb-2 text-xl font-bold text-sage-900">
                  Un projet né d'un vrai besoin
                </h3>
                <p>
                  J'ai créé Pulpe parce que j'en avais marre de mon Excel budget
                  sur mobile. Aujourd'hui, l'app m'aide au quotidien, ainsi que
                  quelques amis. Si elle peut t'aider aussi, tant mieux.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-bold text-sage-900">
                  Gratuit et open source
                </h3>
                <p>
                  Pas de publicité, pas d'abonnement caché, pas de revente de
                  données. Pulpe est un projet personnel que je développe par
                  passion — j'ai un travail qui me plaît, et cette app est ma
                  fierté.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xl font-bold text-sage-900">
                  Tes données sont protégées
                </h3>
                <p>
                  J'utilise des analytics (PostHog, hébergé en Europe) pour
                  améliorer l'app, mais tes montants financiers sont toujours
                  masqués — je ne vois jamais tes chiffres. Tes données ne sont
                  jamais vendues, jamais utilisées pour de la pub. Le code est
                  open source : tu peux vérifier par toi-même.
                </p>
              </div>
            </div>

            {/* Author */}
            <div className="mt-8 flex items-center gap-4 border-t border-sage-200 pt-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black bg-pulpe-200">
                <img src="/icon.png" alt="" className="h-8 w-auto" />
              </div>
              <div>
                <p className="font-bold text-sage-900">Maxime</p>
                <p className="text-sage-500">Créateur de Pulpe</p>
              </div>
            </div>
          </motion.div>

          {/* Badges */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-4"
          >
            {["Open Source", "Hébergé en Europe", "Données masquées"].map(
              (badge, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-pulpe-100 px-4 py-2 text-sm font-semibold text-pulpe-900"
                >
                  <Check className="h-4 w-4" />
                  {badge}
                </span>
              )
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-pulpe-800 py-20 md:py-32">
      {/* Decorative background elements */}
      <motion.div
        animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-10 left-10 h-32 w-32 rounded-full bg-pulpe-600/30"
      />
      <motion.div
        animate={{ y: [0, -20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-pulpe-500/20"
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={staggerContainer}
          className="space-y-8"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-4xl leading-tight font-extrabold tracking-tight text-white md:text-5xl lg:text-6xl"
          >
            Prêt à voir clair ?
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="mx-auto max-w-xl text-xl leading-relaxed text-pulpe-200"
          >
            Crée ton espace en 3 minutes. Gratuit, sans carte bancaire.
          </motion.p>

          <motion.div variants={fadeInUp} className="pt-4">
            <Button
              variant="secondary"
              className="!bg-white !text-pulpe-800 hover:!bg-pulpe-50 !shadow-[6px_6px_0_0_rgba(0,0,0,0.3)]"
              href={APP_URL}
            >
              Commencer maintenant
              <ArrowRight className="h-5 w-5" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-sage-900 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/icon.png" alt="Pulpe" className="h-6 w-auto" />
            <span className="text-xl font-extrabold text-white">Pulpe</span>
          </div>

          <p className="flex items-center gap-1.5 text-sm font-medium text-sage-300">
            Fait avec soin en Suisse 🇨🇭
          </p>

          <div className="flex gap-6 text-sm font-medium text-sage-300">
            <a href="/privacy" className="transition-colors hover:text-white">
              Confidentialité
            </a>
            <a href="/cgu" className="transition-colors hover:text-white">
              CGU
            </a>
            <a
              href="https://github.com/mdesogus/pulpe"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Code source
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
        <PainPoints />
        <Solution />
        <Features />
        <HowItWorks />
        <Availability />
        <WhyFree />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
