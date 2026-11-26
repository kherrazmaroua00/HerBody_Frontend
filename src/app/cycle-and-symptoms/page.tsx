"use client";

import { useState } from "react";
import AppPageHeading from "@/components/ui/AppPageHeading";

const symptomOptions = [
  "Cramps",
  "Headache",
  "Bloating",
  "Low energy",
  "Tenderness",
  "Mood changes",
];

export default function CycleAndSymptomsPage() {
  const [periodStart, setPeriodStart] = useState("");
  const [cycleLength, setCycleLength] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function toggleSymptom(symptom: string) {
    setSaved(false);
    setSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom],
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="cycle"
        eyebrow="Your personal tracker"
        title="Cycle and symptoms"
        description="Record cycle details and symptoms to reflect on patterns over time."
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
        className="max-w-2xl rounded-3xl border border-[#eadcf4] bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 className="text-lg font-bold text-ink">Cycle details</h2>
        <p className="mt-1 text-sm leading-5 text-ink/65">
          These optional details are held in this page session and aren&apos;t sent anywhere.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-ink/80">
            First day of your last period
            <input
              type="date"
              value={periodStart}
              onChange={(event) => {
                setPeriodStart(event.target.value);
                setSaved(false);
              }}
              className="mt-2 h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
            />
          </label>
          <label className="text-xs font-semibold text-ink/80">
            Usual cycle length (optional)
            <div className="relative mt-2">
              <input
                type="number"
                min={1}
                max={90}
                value={cycleLength}
                onChange={(event) => {
                  setCycleLength(event.target.value);
                  setSaved(false);
                }}
                placeholder="Add number of days"
                className="h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 pr-12 text-sm font-normal text-ink outline-none placeholder:text-ink/45 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-normal text-ink/50">
                days
              </span>
            </div>
          </label>
        </div>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold text-ink/80">
            How have you been feeling?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {symptomOptions.map((symptom) => {
              const active = symptoms.includes(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSymptom(symptom)}
                  className={`rounded-full border px-3 py-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                    active
                      ? "border-brand-purple bg-lavender text-brand-purple"
                      : "border-[#eadcf4] bg-white text-ink/70 hover:bg-blush"
                  }`}
                >
                  {symptom}
                </button>
              );
            })}
          </div>
        </fieldset>

        <button
          type="submit"
          className="mt-6 min-h-11 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          Save for this session
        </button>
        <p className="mt-3 min-h-5 text-sm text-brand-purple" role="status" aria-live="polite">
          {saved ? "Your cycle notes are saved for this session." : ""}
        </p>
      </form>
    </main>
  );
}
