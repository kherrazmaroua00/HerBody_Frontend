"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import OrganCard from "@/components/body/OrganCard";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { ORGANS } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

const BodyViewer = dynamic(
  () => import("@/components/body/BodyViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full min-h-80 place-items-center p-6 text-center text-ink/70">
        Loading the interactive body…
      </div>
    ),
  },
);

export default function InteractiveBodyClient({
  initialOrgan,
}: {
  initialOrgan: OrganId | null;
}) {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganId | null>(initialOrgan);
  const liveMessage = selectedOrgan
    ? `${ORGANS[selectedOrgan].label} selected.`
    : "No organ selected.";

  return (
    <main className="mx-auto min-h-dvh max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-pink">
          Your personal body explorer
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-purple sm:text-4xl">
          Interactive body
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/65 sm:text-base">
          Select an organ to explore its role, then ask questions in the companion chat.
          Drag to rotate and use the scroll wheel to zoom.
        </p>
      </section>

      <section className="mx-auto grid max-w-[920px] items-center gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex h-[460px] min-w-0 flex-col overflow-hidden rounded-3xl border border-[#eadcf4] bg-[radial-gradient(ellipse_at_50%_42%,#fff8fd_0%,#f5e9f8_52%,#eadcf4_100%)] shadow-sm sm:h-[500px] lg:h-[540px]">
          <div className="relative min-h-0 flex-1">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-ink/70">
                  Loading the interactive body…
                </div>
              }
            >
              <BodyViewer
                selectedOrgan={selectedOrgan}
                onSelect={setSelectedOrgan}
              />
            </Suspense>
            {selectedOrgan && (
              <div className="absolute right-3 top-1/2 z-10 w-[min(280px,calc(100%-24px))] -translate-y-1/2 sm:right-4">
                <OrganCard selectedOrgan={selectedOrgan} compact />
              </div>
            )}
          </div>

          {selectedOrgan && (
            <div
              className="grid shrink-0 grid-cols-3 gap-2 border-t border-brand-purple/10 bg-white/75 p-3 sm:grid-cols-6"
              role="group"
              aria-label="Choose an organ"
            >
              {(Object.keys(ORGANS) as OrganId[]).map((organId) => {
                const organ = ORGANS[organId];
                const isSelected = selectedOrgan === organId;
                return (
                  <button
                    key={organId}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={organ.label}
                    onClick={() => setSelectedOrgan(organId)}
                    className={`min-h-9 min-w-0 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                      isSelected
                        ? "border-brand-pink bg-brand-pink/10 text-brand-purple"
                        : "border-brand-purple/10 bg-white text-ink/75 hover:border-brand-pink/50 hover:text-brand-purple"
                    }`}
                  >
                    {organ.label}
                  </button>
                );
              })}
            </div>
          )}
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </p>
        </div>

        <div className="min-w-0 lg:self-center">
          <ChatSidebar selectedOrgan={selectedOrgan} onSelect={setSelectedOrgan} />
        </div>
      </section>
    </main>
  );
}
