"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/health-journey", label: "Home" },
  { href: "/healthy-life", label: "Healthy Life" },
  { href: "/interactive-body", label: "Interactive Body" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-brand-purple/10 bg-white/80">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6"
      >
        <Link
          href="/health-journey"
          className="mr-auto shrink-0 text-xl font-bold text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-purple"
        >
          HerBody
        </Link>
        <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-2 text-sm font-medium sm:gap-x-6">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-full px-3 py-1.5 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                  isActive
                    ? "bg-lavender text-brand-purple"
                    : "text-ink/70 hover:bg-blush hover:text-brand-purple"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
