import Image from "next/image";
import Link from "next/link";
import { angularUrl } from "@/lib/config";

const navLinks = [
  { href: "/#features", label: "Fonctionnalités" },
  { href: "/#platforms", label: "Applications" },
  { href: "/#why-free", label: "Confiance" },
];

export function Header() {
  return (
    <header className="site-header sticky inset-x-0 top-0 z-50 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <nav
        aria-label="Navigation principale"
        className="site-header-inner mx-auto grid min-h-[58px] max-w-[var(--content-max)] grid-cols-[1fr_auto] items-center gap-3 rounded-full px-3.5 min-[620px]:px-5 min-[721px]:grid-cols-[1fr_auto_1fr]"
      >
        <Link
          href="/"
          className="site-brand flex min-h-11 shrink-0 items-center gap-2 justify-self-start rounded-full px-1 font-bold tracking-[-0.03em] text-text"
          aria-label="Pulpe, accueil"
        >
          <span className="site-brand-mark" aria-hidden="true">
            <Image
              src="/app-icon.webp"
              alt=""
              width={36}
              height={36}
              className="size-9"
            />
          </span>
          <span className="text-[1.05rem]">Pulpe</span>
        </Link>

        <div className="site-primary-nav hidden items-center gap-1 min-[721px]:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold tracking-[-0.015em] text-text-secondary transition-[background-color,color,scale] duration-200 hover:text-primary active:scale-[0.97] motion-reduce:scale-100 motion-reduce:transition-none"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href={angularUrl("/signup", "header_commencer")}
          className="site-status relative inline-flex min-h-9 shrink-0 items-center justify-self-end rounded-full px-3.5 text-sm font-semibold text-on-primary"
          data-cta-name="commencer"
          data-cta-location="header"
          data-cta-destination="/signup"
        >
          <span className="min-[620px]:hidden">Essayer</span>
          <span className="hidden min-[620px]:inline">Créer mon budget</span>
        </a>
      </nav>
    </header>
  );
}
