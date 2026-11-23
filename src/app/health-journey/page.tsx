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

export default function HealthJourneyPage() {
  const [selectedOrgan, setSelectedOrgan] = useState<OrganId | null>(null);

  const liveMessage = selectedOrgan
    ? `${ORGANS[selectedOrgan].label} selected.`
    : "No organ selected.";

  return (
    <main className="dashboard-main">
        <header className="dashboard-topbar">
          <span>Anatomy <b>›</b> <strong>Explorer</strong></span>
          <span className="cycle-badge">● DAY 14 · OVULATORY</span>
        </header>

        <div className="dashboard-heading">
          <div>
            <p className="dashboard-eyebrow">● 3D FEMTECH ATLAS</p>
            <h1>Explore Your Body.</h1>
            <p>Interactive biological atlas in translucent resonance with your natural cycles.</p>
          </div>
          <div className="body-tabs" aria-label="Body view">
            <button type="button" className="selected">Whole Body</button>
            <button type="button" disabled>Pelvic System</button>
            <button type="button" disabled>Neuroendocrine</button>
          </div>
        </div>

        <div className="atlas-stage">
          <div className="anatomy-visual">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-sm text-ink/70">
                  Loading the interactive body…
                </div>
              }
            >
              <BodyViewer selectedOrgan={selectedOrgan} onSelect={setSelectedOrgan} />
            </Suspense>
            <small className="scale-label">◉ &nbsp; Coronal Educational Stance · Scale 1:1</small>
          </div>

          <div id="organ-details" className="organ-card">
            <OrganCard selectedOrgan={selectedOrgan} />
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Choose an organ">
              {(Object.keys(ORGANS) as OrganId[]).map((organId) => {
                const organ = ORGANS[organId];
                const isSelected = selectedOrgan === organId;
                return (
                  <button
                    key={organId}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedOrgan(organId)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                      isSelected
                        ? "border-brand-pink bg-brand-pink text-white"
                        : "border-brand-purple/10 bg-white text-brand-purple"
                    }`}
                  >
                    {organ.label}
                  </button>
                );
              })}
            </div>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveMessage}
            </p>
          </div>
          <div id="dashboard-chat" className="dashboard-chat">
            <ChatSidebar selectedOrgan={selectedOrgan} onSelect={setSelectedOrgan} />
          </div>
        </div>

        <footer className="dashboard-footer">
          <span>♧ CLINICAL MODEL · 3D FEMTECH ANATOMICAL ATLAS</span>
          <span>Select pin or rotate angle to view hormonal dynamics</span>
        </footer>
    </main>
  );
}
