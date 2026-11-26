"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useState, useSyncExternalStore } from "react";
import MoodCheckIn from "@/components/home/MoodCheckIn";
import { NavigationIconView } from "@/components/icons/NavigationIcons";
import { ORGANS } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

const BodyViewer = dynamic(() => import("@/components/body/BodyViewer"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-center text-sm text-brand-purple/70">
      Loading your body explorer…
    </div>
  ),
});

const organIds = Object.keys(ORGANS) as OrganId[];

function subscribeToProfile(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("herbody-profile-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("herbody-profile-updated", callback);
  };
}

function getProfileName() {
  return sessionStorage.getItem("herbody_user_name") || "there";
}

function getServerProfileName() {
  return "there";
}

export default function HomeDashboard() {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganId | null>(null);
  const name = useSyncExternalStore(
    subscribeToProfile,
    getProfileName,
    getServerProfileName,
  );

  const organ = selectedOrgan ? ORGANS[selectedOrgan] : null;
  const chatHref = selectedOrgan
    ? `/interactive-body?organ=${selectedOrgan}`
    : "/interactive-body";

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1500px] px-4 py-4 sm:px-6 lg:px-7 lg:py-4">
      <header className="mb-4">
        <span className="inline-flex rounded-full border border-brand-pink/15 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
          Welcome back
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-purple sm:text-3xl">
          Good to see you, {name}
        </h1>
        <p className="mt-1 text-sm text-ink/65">
          Know your body. Understand your health. Own your journey.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <section className="grid min-h-[310px] overflow-hidden rounded-3xl border border-[#eadcf4] bg-[linear-gradient(120deg,#f7edff,#f0e2fb)] shadow-[0_3px_12px_rgba(80,43,108,0.04)] md:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[220px] p-3 sm:p-4">
            <div className="absolute inset-4 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_42%,#fff8fd_0%,#f5e9f8_52%,#eadcf4_100%)]" />
            <div className="relative h-full min-h-[220px]">
              <Suspense
                fallback={
                  <div className="grid h-full place-items-center text-sm text-brand-purple/70">
                    Loading your body explorer…
                  </div>
                }
              >
                <BodyViewer selectedOrgan={selectedOrgan} onSelect={setSelectedOrgan} />
              </Suspense>
              <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[10px] font-medium text-ink/65 shadow-sm">
                Select an organ or rotate to explore
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center p-4 sm:p-5">
            <span className="w-fit rounded-full border border-brand-purple/10 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-brand-purple">
              Interactive explorer
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">
              {organ ? `Meet your ${organ.label.toLowerCase()}` : "Meet your body"}
            </h2>
            <p className="mt-1 min-h-10 text-sm leading-5 text-ink/65">
              {organ
                ? organ.role
                : "Tap an organ to explore how it works, then ask questions in plain language."}
            </p>

            {organ && (
              <p className="mt-2 text-xs leading-5 text-ink/70">
                {organ.facts[0]}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose an organ">
              {organIds.map((organId) => {
                const item = ORGANS[organId];
                const active = selectedOrgan === organId;
                return (
                  <button
                    key={organId}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedOrgan(active ? null : organId)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                      active
                        ? "border-brand-purple bg-brand-purple text-white"
                        : "border-white bg-white/90 text-brand-purple hover:border-brand-purple/30"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <Link
              href={chatHref}
              className="mt-4 inline-flex min-h-10 items-center justify-between gap-3 self-start rounded-full bg-brand-purple px-4 text-xs font-semibold text-white shadow-[0_5px_12px_rgba(74,38,103,0.2)] transition hover:-translate-y-0.5 hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-purple"
            >
              <span>{organ ? `Ask about the ${organ.label.toLowerCase()}` : "Explore and chat"}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </section>

        <MoodCheckIn compact />
      </div>

      <section className="mt-3 grid gap-3 md:grid-cols-3" aria-label="Your health overview">
        <article className="flex min-h-[160px] flex-col rounded-3xl border border-[#eadcf4] bg-white p-4 shadow-[0_3px_12px_rgba(80,43,108,0.04)]">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-lavender/60 text-brand-purple">
              <NavigationIconView name="cycle" className="size-4" />
            </span>
            <span className="text-[11px] font-semibold text-brand-pink">Cycle health</span>
          </div>
          <h2 className="mt-2 text-base font-bold text-ink">Your cycle</h2>
          <p className="mt-1 flex-1 text-xs leading-5 text-ink/65">
            Add your cycle details to see your personal tracking overview.
          </p>
          <Link
            href="/cycle-and-symptoms"
            className="mt-2 inline-flex min-h-8 items-center justify-center rounded-full border border-brand-purple/35 px-4 text-xs font-semibold text-brand-purple transition hover:bg-lavender/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            Open cycle tracking
          </Link>
        </article>

        <article className="flex min-h-[160px] flex-col rounded-3xl border border-[#eadcf4] bg-white p-4 shadow-[0_3px_12px_rgba(80,43,108,0.04)]">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-lavender/60 text-brand-purple">
              <NavigationIconView name="checkin" className="size-4" />
            </span>
            <span className="text-[11px] font-semibold text-ink/50">Your wellbeing</span>
          </div>
          <h2 className="mt-2 text-base font-bold text-ink">Daily check-ins</h2>
          <p className="mt-1 flex-1 text-xs leading-5 text-ink/65">
            Make space to notice how you feel and build a gentle daily routine.
          </p>
          <Link
            href="/daily-check-in"
            className="mt-2 inline-flex min-h-8 items-center justify-center rounded-full border border-brand-purple/35 px-4 text-xs font-semibold text-brand-purple transition hover:bg-lavender/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            Open check-in
          </Link>
        </article>

        <article className="flex min-h-[160px] flex-col rounded-3xl border border-[#eadcf4] bg-white p-4 shadow-[0_3px_12px_rgba(80,43,108,0.04)]">
          <div className="flex items-center justify-between">
            <span className="grid size-9 place-items-center rounded-full bg-lavender/60 text-brand-purple">
              <NavigationIconView name="documents" className="size-4" />
            </span>
            <span className="text-[11px] font-semibold text-ink/50">Your records</span>
          </div>
          <h2 className="mt-2 text-base font-bold text-ink">Health records</h2>
          <p className="mt-1 flex-1 text-xs leading-5 text-ink/65">
            Keep track of documents and lab results in one place.
          </p>
          <Link
            href="/documents"
            className="mt-2 inline-flex min-h-8 items-center justify-center rounded-full border border-brand-purple/35 px-4 text-xs font-semibold text-brand-purple transition hover:bg-lavender/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            Open records
          </Link>
        </article>
      </section>
    </main>
  );
}
