"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  averagePeriodDuration,
  dateDayNumber,
  dateFromDayNumber,
  estimateNextPeriod,
} from "@/lib/cycle-estimates";
import {
  createMenstrualCycle,
  getMenstrualCycle,
  getMenstrualCycles,
  type MenstrualCycle,
} from "@/lib/api/cycle-symptoms";

function formatCycleDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function todayForInput(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number): string {
  const day = dateDayNumber(value);
  return day === null ? "" : dateFromDayNumber(day + days);
}

function periodLengthLabel(cycle: MenstrualCycle): string {
  const start = dateDayNumber(cycle.startDate);
  const end = dateDayNumber(cycle.endDate);
  if (start === null || end === null || end < start) return `${cycle.startDate} to ${cycle.endDate}`;
  const days = end - start + 1;
  return `${days}-day period`;
}

function isConflict(error: unknown): boolean {
  return error instanceof Error && "kind" in error && error.kind === "conflict";
}

export default function MenstrualCycleManager({
  onCreated,
  initialStartDate,
}: {
  onCreated: () => void;
  /** Prefills "Log a period" (e.g. a day picked in the calendar). */
  initialStartDate?: string;
}) {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);

  const [startDate, setStartDate] = useState(initialStartDate ?? "");
  const [periodLength, setPeriodLength] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleDetail, setCycleDetail] = useState<MenstrualCycle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);

  useEffect(() => {
    let active = true;
    void getMenstrualCycles()
      .then((records) => {
        if (active) setCycles(records);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setLoadError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your menstrual cycles.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!selectedCycleId) return;

    let active = true;
    void getMenstrualCycle(selectedCycleId)
      .then((detail) => {
        if (active) setCycleDetail(detail);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setDetailError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load cycle details.",
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCycleId, detailRetry]);

  async function saveCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    if (!startDate) {
      setFormError("Choose a period start date.");
      return;
    }
    const durationDays = Number(periodLength);
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      setFormError("Enter a period length of at least one day.");
      return;
    }
    const endDate = addDays(startDate, durationDays - 1);
    if (!endDate) {
      setFormError("Choose a valid period start date.");
      return;
    }

    setSaving(true);
    try {
      await createMenstrualCycle({
        startDate,
        endDate,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setStartDate("");
      setPeriodLength("");
      setNotes("");
      setSuccess("Your menstrual cycle has been recorded.");
      setLoading(true);
      setLoadError("");
      setRetry((current) => current + 1);
      onCreated();
    } catch (requestError) {
      setFormError(
        isConflict(requestError)
          ? requestError instanceof Error
            ? requestError.message
            : "A menstrual cycle with these dates already exists."
          : requestError instanceof Error
            ? requestError.message
            : "Unable to save this menstrual cycle. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function logPeriodToday() {
    const today = todayForInput();
    const duration = periodLength || averagePeriodDuration(cycles)?.toString() || "";
    setStartDate(today);
    setPeriodLength(duration);
    setFormError("");
    setSuccess("");
  }

  const sortedCycles = [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const prediction = estimateNextPeriod(cycles);
  const calculatedEndDate = startDate && Number.isInteger(Number(periodLength)) && Number(periodLength) > 0
    ? addDays(startDate, Number(periodLength) - 1)
    : "";

  return (
    <section className="rounded-3xl border border-[#eadcf4] bg-white p-3 shadow-[0_3px_12px_rgba(80,43,108,0.04)] sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-brand-pink/20 bg-brand-pink/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
            Menstrual cycle
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-ink">
            Cycle tracking
          </h2>
          <p className="mt-1 text-xs leading-4 text-ink/60">
            Record your cycle dates and review your cycle history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError("");
            setRetry((current) => current + 1);
          }}
          disabled={loading}
          className="shrink-0 rounded-full border border-brand-purple/25 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:opacity-50"
        >
          Refresh cycles
        </button>
      </div>

      <div className="mt-3 grid items-start gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form className="space-y-2 rounded-2xl bg-[#fcf9fe] p-3 sm:sticky sm:top-0" onSubmit={saveCycle}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink">Log a period</h3>
            <button
              type="button"
              onClick={logPeriodToday}
              className="shrink-0 rounded-full border border-brand-purple/25 px-2.5 py-1 text-[11px] font-semibold text-brand-purple transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
            >
              Log period
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-ink/80" htmlFor="cycle-start-date">
              Start date
              <input
                id="cycle-start-date"
                type="date"
                required
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setFormError("");
                  setSuccess("");
                }}
                className="mt-1 h-9 min-w-0 w-full rounded-xl border border-[#eadcf4] bg-white px-1 text-[11px] font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              />
            </label>
            <label className="text-xs font-semibold text-ink/80" htmlFor="cycle-period-length">
              Period length (days)
              <input
                id="cycle-period-length"
                type="number"
                min={1}
                step={1}
                required
                value={periodLength}
                onChange={(event) => {
                  setPeriodLength(event.target.value);
                  setFormError("");
                  setSuccess("");
                }}
                className="mt-1 h-9 min-w-0 w-full rounded-xl border border-[#eadcf4] bg-white px-1 text-[11px] font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              />
            </label>
          </div>
          <p className="text-xs text-ink/60" aria-live="polite">
            End date: {calculatedEndDate ? formatCycleDate(calculatedEndDate) : "Set a start date and period length"}
          </p>
          <label className="block text-xs font-semibold text-ink/80" htmlFor="cycle-notes">
            Notes <span className="font-normal text-ink/50">(optional)</span>
            <textarea
              id="cycle-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setFormError("");
                setSuccess("");
              }}
              rows={1}
              className="mt-1 w-full resize-y rounded-xl border border-[#eadcf4] bg-white px-2 py-1 text-xs font-normal leading-5 text-ink outline-none placeholder:text-ink/45 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              placeholder="Add a note about this cycle..."
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white shadow-[0_4px_8px_rgba(74,38,103,0.2)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {saving ? "Saving cycle..." : "Save cycle"}
          </button>
          <p
            className={`min-h-5 text-center text-xs ${formError ? "text-red-700" : "text-brand-purple"}`}
            role={formError ? "alert" : "status"}
            aria-live="polite"
          >
            {formError || success}
          </p>
        </form>

        <div>
          <h3 className="text-sm font-bold text-ink">Cycle history</h3>
          <p className="mt-1 text-xs leading-5 text-ink/55">
            Your saved cycle dates and notes.
          </p>
          <div className="mt-2 rounded-xl bg-lavender/25 px-3 py-2 text-xs text-ink/70" aria-live="polite">
            {prediction ? (
              <p>
                Next period estimate: <strong>{formatCycleDate(prediction.nextStartDate)}</strong>
                <span className="block text-ink/55">
                  Based on your average {prediction.averageCycleLength}-day cycle.
                </span>
              </p>
            ) : (
              <p>Log at least two periods to estimate your next start date.</p>
            )}
          </div>

          {selectedCycleId && (
            <div className="mt-4 rounded-2xl border border-brand-purple/20 bg-[linear-gradient(145deg,#fff,#fcf8ff)] p-4" aria-live="polite">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-ink">Cycle details</h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCycleId(null);
                    setCycleDetail(null);
                    setDetailError("");
                    setDetailLoading(false);
                  }}
                  className="text-xs font-semibold text-brand-purple underline underline-offset-2"
                >
                  Close
                </button>
              </div>
              {detailLoading ? (
                <p className="mt-3 text-sm text-ink/60" role="status">Loading cycle details...</p>
              ) : detailError ? (
                <div className="mt-3 text-sm text-red-800" role="alert">
                  <p>{detailError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDetailLoading(true);
                      setDetailError("");
                      setDetailRetry((current) => current + 1);
                    }}
                    className="mt-2 font-semibold underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              ) : cycleDetail ? (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-ink/50">Start date</dt>
                    <dd className="mt-1 font-semibold text-ink">{formatCycleDate(cycleDetail.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink/50">End date</dt>
                    <dd className="mt-1 font-semibold text-ink">{formatCycleDate(cycleDetail.endDate)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold text-ink/50">Notes</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-ink/75">
                      {cycleDetail.notes || "No notes added."}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          )}

          <div className="mt-3">
            {loading ? (
              <div className="flex min-h-28 items-center justify-center gap-3 text-sm text-brand-purple/75" role="status">
                <span className="size-5 animate-spin rounded-full border-2 border-brand-purple/20 border-t-brand-purple" aria-hidden="true" />
                Loading your cycles...
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
                <p>{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setLoadError("");
                    setRetry((current) => current + 1);
                  }}
                  className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  Try again
                </button>
              </div>
            ) : sortedCycles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9c8e5] bg-[#fcf9fe] px-5 py-8 text-center">
                <p className="text-sm font-semibold text-ink">No cycles recorded yet</p>
                <p className="mt-1 text-xs text-ink/60">Your cycle history will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sortedCycles.map((cycle) => (
                  <li key={String(cycle.id)} className="rounded-2xl border border-[#eadcf4] bg-[linear-gradient(145deg,#fff,#fcf8ff)] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-ink">
                          {formatCycleDate(cycle.startDate)} – {formatCycleDate(cycle.endDate)}
                        </h4>
                        <p className="mt-0.5 text-xs text-ink/55">{periodLengthLabel(cycle)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCycleId(String(cycle.id));
                          setCycleDetail(null);
                          setDetailError("");
                          setDetailLoading(true);
                        }}
                        className="shrink-0 text-xs font-semibold text-brand-purple underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                      >
                        View details
                      </button>
                    </div>
                    {cycle.notes && (
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-ink/65">
                        {cycle.notes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
