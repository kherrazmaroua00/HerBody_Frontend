"use client";

import { useEffect, useMemo, useState } from "react";
import CycleCalendar, { KIND_LABEL, buildCycleModel, dayNumber } from "@/components/cycle/CycleCalendar";
import {
  getCycleSymptoms,
  getMenstrualCycles,
  type CycleSymptom,
  type MenstrualCycle,
} from "@/lib/api/cycle-symptoms";
import { averagePeriodDuration, estimateNextPeriod } from "@/lib/cycle-estimates";

function formatSymptomType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatLongDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const actionButton =
  "rounded-full border border-brand-purple/25 px-3 py-1.5 text-xs font-semibold text-brand-purple transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple";

export default function CycleCalendarView({
  onLogPeriod,
  onLogSymptom,
}: {
  /** Opens the Cycle view with this start date prefilled. */
  onLogPeriod: (date: string) => void;
  /** Opens the Symptoms view with this date prefilled. */
  onLogSymptom: (date: string) => void;
}) {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [symptoms, setSymptoms] = useState<CycleSymptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([getMenstrualCycles(), getCycleSymptoms()]).then(([cycleResult, symptomResult]) => {
      if (!active) return;
      const problems: string[] = [];
      if (cycleResult.status === "fulfilled") setCycles(cycleResult.value);
      else problems.push(errorText(cycleResult.reason, "Unable to load your cycles."));
      if (symptomResult.status === "fulfilled") setSymptoms(symptomResult.value);
      else problems.push(errorText(symptomResult.reason, "Unable to load your symptoms."));
      // The same message (e.g. "please sign in") is shown once.
      setErrors([...new Set(problems)]);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [retry]);

  const averageCycleLength = useMemo(() => estimateNextPeriod(cycles)?.averageCycleLength ?? null, [cycles]);
  const averagePeriodLength = useMemo(() => averagePeriodDuration(cycles), [cycles]);
  const model = useMemo(
    () => buildCycleModel(cycles, averageCycleLength, averagePeriodLength),
    [cycles, averageCycleLength, averagePeriodLength],
  );

  const selectedDay = selectedDate ? dayNumber(selectedDate) : null;
  const info = selectedDay !== null ? model.info(selectedDay) : null;
  const daySymptoms = selectedDay === null
    ? []
    : symptoms
      .filter((symptom) => dayNumber(symptom.recordedOn) === selectedDay)
      .sort((a, b) => b.severity - a.severity);

  return (
    <section className="min-h-full rounded-3xl border border-[#eadcf4] bg-white p-3 shadow-[0_3px_12px_rgba(80,43,108,0.04)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-full border border-brand-pink/20 bg-brand-pink/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
            Overview
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">Calendar</h2>
          <p className="mt-1 text-xs leading-4 text-ink/60">Your periods, estimates and symptoms in one month view.</p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setErrors([]);
            setRetry((value) => value + 1);
          }}
          className={`shrink-0 disabled:opacity-50 ${actionButton}`}
        >
          Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {errors.map((message) => <p key={message}>{message}</p>)}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setErrors([]);
              setRetry((value) => value + 1);
            }}
            className="mt-2 text-xs font-semibold underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-brand-purple/75" role="status">
          <span className="size-5 animate-spin rounded-full border-2 border-brand-purple/20 border-t-brand-purple" aria-hidden="true" />
          Loading your calendar...
        </div>
      ) : (
        <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <CycleCalendar
            cycles={cycles}
            symptoms={symptoms}
            averageCycleLength={averageCycleLength}
            averagePeriodLength={averagePeriodLength}
            selectedDate={selectedDate ?? undefined}
            onSelectDate={setSelectedDate}
          />

          <aside aria-live="polite" className="rounded-3xl bg-[#fcf9fe] p-4">
            {!selectedDate || !info ? (
              <div className="py-6 text-center">
                <p className="text-sm font-semibold text-ink">Select a day</p>
                <p className="mt-1 text-xs text-ink/55">Tap a day in the calendar to see its phase and symptoms.</p>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-bold text-ink">{formatLongDate(selectedDate)}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {info.cycleDay && (
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-ink/70">Cycle day {info.cycleDay}</span>
                  )}
                  {info.kind && (
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${
                      info.kind === "period" ? "bg-[#f6b9c3] text-ink" : info.kind === "predicted" ? "bg-[#fde6ea] text-ink/75" : "bg-[#c3c9f5] text-ink"
                    }`}>
                      {KIND_LABEL[info.kind].charAt(0).toUpperCase() + KIND_LABEL[info.kind].slice(1)}
                    </span>
                  )}
                  {info.ovulation && <span className="rounded-full bg-[#f9df7b] px-2.5 py-1 font-semibold text-ink">Estimated ovulation</span>}
                  {!info.kind && !info.ovulation && !info.cycleDay && (
                    <span className="text-ink/50">No cycle information for this day.</span>
                  )}
                </div>

                <h4 className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ink/45">
                  Symptoms ({daySymptoms.length})
                </h4>
                {daySymptoms.length === 0 ? (
                  <p className="mt-1.5 text-xs text-ink/55">No symptoms logged on this day.</p>
                ) : (
                  <ul className="mt-1.5 space-y-2">
                    {daySymptoms.map((symptom) => (
                      <li key={symptom.id} className="rounded-2xl border border-[#eadcf4] bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-ink">{formatSymptomType(symptom.symptomType)}</span>
                          <span className="flex items-center gap-1" aria-label={`Severity ${symptom.severity} of 5`}>
                            {[1, 2, 3, 4, 5].map((level) => (
                              <i
                                key={level}
                                aria-hidden="true"
                                className={`inline-block h-1.5 w-3 rounded-full ${level <= symptom.severity ? "bg-brand-purple" : "bg-lavender/60"}`}
                              />
                            ))}
                          </span>
                        </div>
                        {symptom.notes && (
                          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-ink/65">{symptom.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onLogSymptom(selectedDate)} className={actionButton}>
                    + Add a symptom
                  </button>
                  <button type="button" onClick={() => onLogPeriod(selectedDate)} className={actionButton}>
                    Log a period from this day
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
