"use client";

import { useState } from "react";
import CycleSymptomsTracker from "@/components/cycle/CycleSymptomsTracker";
import MenstrualCycleManager from "@/components/cycle/MenstrualCycleManager";

export default function CycleTrackingWorkspace() {
  const [cyclesRefreshKey, setCyclesRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState<"cycles" | "symptoms">("cycles");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="mb-3 inline-flex shrink-0 rounded-full border border-[#eadcf4] bg-white p-1 shadow-sm"
        role="group"
        aria-label="Choose cycle tracking view"
      >
        <button
          type="button"
          aria-pressed={activeView === "cycles"}
          onClick={() => setActiveView("cycles")}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
            activeView === "cycles"
              ? "bg-brand-purple text-white shadow-sm"
              : "text-ink/65 hover:bg-lavender/40"
          }`}
        >
          Cycle
        </button>
        <button
          type="button"
          aria-pressed={activeView === "symptoms"}
          onClick={() => setActiveView("symptoms")}
          className={`min-h-9 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
            activeView === "symptoms"
              ? "bg-brand-purple text-white shadow-sm"
              : "text-ink/65 hover:bg-lavender/40"
          }`}
        >
          Symptoms
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeView === "cycles" ? (
          <MenstrualCycleManager onCreated={() => setCyclesRefreshKey((key) => key + 1)} />
        ) : (
          <CycleSymptomsTracker cyclesRefreshKey={cyclesRefreshKey} />
        )}
      </div>
    </div>
  );
}
