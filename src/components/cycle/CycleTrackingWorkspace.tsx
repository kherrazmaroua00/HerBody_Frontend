"use client";

import { useState } from "react";
import CycleCalendarView from "@/components/cycle/CycleCalendarView";
import CycleSymptomsTracker from "@/components/cycle/CycleSymptomsTracker";
import MenstrualCycleManager from "@/components/cycle/MenstrualCycleManager";

type View = "calendar" | "cycles" | "symptoms";

const VIEWS: { id: View; label: string }[] = [
  { id: "calendar", label: "Calendar" },
  { id: "cycles", label: "Cycle" },
  { id: "symptoms", label: "Symptoms" },
];

export default function CycleTrackingWorkspace() {
  const [cyclesRefreshKey, setCyclesRefreshKey] = useState(0);
  const [activeView, setActiveView] = useState<View>("calendar");
  /** Date picked in the calendar, handed to the form of the view it opens. */
  const [prefill, setPrefill] = useState<{ view: View; date: string } | null>(null);

  function open(view: View, date?: string) {
    setPrefill(date ? { view, date } : null);
    setActiveView(view);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="mb-3 inline-flex shrink-0 self-start rounded-full border border-[#eadcf4] bg-white p-1 shadow-sm"
        role="group"
        aria-label="Choose cycle tracking view"
      >
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeView === id}
            onClick={() => open(id)}
            className={`min-h-9 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
              activeView === id
                ? "bg-brand-purple text-white shadow-sm"
                : "text-ink/65 hover:bg-lavender/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {activeView === "calendar" ? (
          <CycleCalendarView
            onLogPeriod={(date) => open("cycles", date)}
            onLogSymptom={(date) => open("symptoms", date)}
          />
        ) : activeView === "cycles" ? (
          <MenstrualCycleManager
            initialStartDate={prefill?.view === "cycles" ? prefill.date : undefined}
            onCreated={() => setCyclesRefreshKey((key) => key + 1)}
          />
        ) : (
          <CycleSymptomsTracker
            cyclesRefreshKey={cyclesRefreshKey}
            initialRecordedOn={prefill?.view === "symptoms" ? prefill.date : undefined}
          />
        )}
      </div>
    </div>
  );
}
