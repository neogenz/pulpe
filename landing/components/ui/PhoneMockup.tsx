import Image from "next/image";

interface PhoneMockupProps {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function PhoneMockup({
  src,
  alt,
  priority = false,
  className = "",
}: PhoneMockupProps) {
  return (
    <div
      className={`phone-shell relative rounded-[clamp(2.35rem,7vw,3.5rem)] bg-[#171916] p-[clamp(5px,1.3vw,9px)] shadow-[0_32px_80px_rgba(0,45,15,0.22),0_8px_24px_rgba(0,45,15,0.16)] ring-1 ring-black/35 ${className}`}
    >
      <div className="phone-screen relative aspect-[750/1630] overflow-hidden rounded-[clamp(2rem,6.3vw,3rem)] bg-surface">
        <Image
          src={src}
          alt={alt}
          width={750}
          height={1630}
          sizes="(min-width: 941px) 390px, (min-width: 621px) 350px, 78vw"
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          className="h-full w-full object-cover"
        />
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[clamp(5px,1.3vw,9px)] rounded-[clamp(2rem,6.3vw,3rem)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[12%] left-[5px] w-px rounded-full bg-white/24"
      />
    </div>
  );
}
