"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  CYCLE_SYMPTOM_TYPES,
  createCycleSymptom,
  getCycleSymptom,
  getCycleSymptoms,
  getMenstrualCycles,
  type CycleSymptom,
  type CycleSymptomType,
  type MenstrualCycle,
} from "@/lib/api/cycle-symptoms";

function todayForInput(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRecordedDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function cycleLabel(cycles: MenstrualCycle[], cycleId: string | number): string {
  const cycle = cycles.find((item) => String(item.id) === String(cycleId));
  return cycle ? `Cycle starting ${formatRecordedDate(cycle.startDate)}` : `Cycle ${cycleId}`;
}

function formatSymptomType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function CycleSymptomsTracker({
  cyclesRefreshKey,
  initialRecordedOn,
}: {
  cyclesRefreshKey: number;
  /** Prefills the symptom date (e.g. a day picked in the calendar). */
  initialRecordedOn?: string;
}) {
  const [cycles, setCycles] = useState<MenstrualCycle[]>([]);
  const [cyclesLoading, setCyclesLoading] = useState(true);
  const [cyclesError, setCyclesError] = useState("");
  const [cyclesRetry, setCyclesRetry] = useState(0);

  const [symptoms, setSymptoms] = useState<CycleSymptom[]>([]);
  const [symptomsLoading, setSymptomsLoading] = useState(true);
  const [symptomsError, setSymptomsError] = useState("");
  const [symptomsRetry, setSymptomsRetry] = useState(0);

  const [cycleId, setCycleId] = useState("");
  const [symptomType, setSymptomType] = useState<CycleSymptomType | "">("");
  const [severity, setSeverity] = useState("1");
  const [notes, setNotes] = useState("");
  const [recordedOn, setRecordedOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
  const [symptomDetail, setSymptomDetail] = useState<CycleSymptom | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);

  useEffect(() => {
    void Promise.resolve().then(() => setRecordedOn(initialRecordedOn || todayForInput()));
  }, [initialRecordedOn]);

  useEffect(() => {
    let active = true;
    void getMenstrualCycles()
      .then((records) => {
        if (!active) return;
        setCycles(records);
        // From the calendar: the cycle that started most recently on or before the chosen day.
        const forDate = initialRecordedOn
          ? records
            .filter((cycle) => cycle.startDate.slice(0, 10) <= initialRecordedOn)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
          : undefined;
        setCycleId((current) =>
          forDate
            ? String(forDate.id)
            : records.some((cycle) => String(cycle.id) === current)
              ? current
              : records[0]
                ? String(records[0].id)
                : "",
        );
      })
      .catch((requestError: unknown) => {
        if (active) {
          setCyclesError(
            requestError instanceof Error ? requestError.message : "Unable to load your cycles.",
          );
        }
      })
      .finally(() => {
        if (active) setCyclesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cyclesRefreshKey, cyclesRetry, initialRecordedOn]);

  useEffect(() => {
    let active = true;
    void getCycleSymptoms()
      .then((records) => {
        if (active) setSymptoms(records);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setSymptomsError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your symptom history.",
          );
        }
      })
      .finally(() => {
        if (active) setSymptomsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symptomsRetry]);

  useEffect(() => {
    if (!selectedSymptomId) return;

    let active = true;
    void getCycleSymptom(selectedSymptomId)
      .then((detail) => {
        if (active) setSymptomDetail(detail);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setDetailError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load symptom details.",
          );
        }
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedSymptomId, detailRetry]);

  async function saveSymptom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setSuccess("");

    const selectedCycle = cycles.find((cycle) => String(cycle.id) === cycleId);
    if (!selectedCycle) {
      setFormError("Select one of your cycles before recording a symptom.");
      return;
    }

    if (!symptomType) {
      setFormError("Select a symptom type.");
      return;
    }

    const severityValue = Number(severity);
    if (!Number.isInteger(severityValue) || severityValue < 1 || severityValue > 5) {
      setFormError("Choose a severity from 1 to 5.");
      return;
    }

    if (!recordedOn || Number.isNaN(Date.parse(`${recordedOn}T00:00:00`))) {
      setFormError("Choose the date when the symptom was recorded.");
      return;
    }

    setSaving(true);
    try {
      await createCycleSymptom({
        cycleId: selectedCycle.id,
        symptomType,
        severity: severityValue,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        recordedOn,
      });
      setSymptomType("");
      setNotes("");
      setSuccess("Your symptom has been recorded.");
      setSymptomsLoading(true);
      setSymptomsError("");
      setSymptomsRetry((retry) => retry + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to record this symptom. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-full gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="rounded-3xl border border-[#eadcf4] bg-white p-3 shadow-[0_3px_12px_rgba(80,43,108,0.04)] sm:p-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink">
            Record a symptom
          </h3>
        </div>

        <form className="mt-3 space-y-2" onSubmit={saveSymptom}>
          <label className="block text-xs font-semibold text-ink/80">
            Menstrual cycle
            {cyclesLoading ? (
              <span className="mt-1 flex h-9 items-center gap-2 rounded-xl border border-[#eadcf4] px-2 text-xs font-normal text-ink/55" role="status">
                <span className="size-4 animate-spin rounded-full border-2 border-brand-purple/20 border-t-brand-purple" aria-hidden="true" />
                Loading your cycles...
              </span>
            ) : cyclesError ? (
              <span className="mt-1 block rounded-xl border border-red-200 bg-red-50 p-2 text-xs font-normal text-red-800" role="alert">
                {cyclesError}
                <button
                  type="button"
                  onClick={() => {
                    setCyclesLoading(true);
                    setCyclesError("");
                    setCyclesRetry((retry) => retry + 1);
                  }}
                  className="ml-2 font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </span>
            ) : cycles.length === 0 ? (
              <span className="mt-1 block rounded-xl border border-dashed border-[#d9c8e5] bg-[#fcf9fe] p-2 text-xs font-normal text-ink/60">
                No cycles recorded yet. Record a menstrual cycle above before adding symptoms.
              </span>
            ) : (
              <select
                required
                value={cycleId}
                onChange={(event) => {
                  setCycleId(event.target.value);
                  setFormError("");
                  setSuccess("");
                }}
                className="mt-1 h-9 w-full rounded-xl border border-[#eadcf4] bg-white px-2 text-xs font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              >
                <option value="" disabled>Select a cycle</option>
                {cycles.map((cycle) => (
                  <option key={String(cycle.id)} value={String(cycle.id)}>
                    Cycle starting {formatRecordedDate(cycle.startDate)}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block text-xs font-semibold text-ink/80" htmlFor="symptom-type">
            Symptom type
            <select
              id="symptom-type"
              required
              value={symptomType}
              onChange={(event) => {
                const selectedType = CYCLE_SYMPTOM_TYPES.find(
                  (type) => type === event.target.value,
                ) ?? "";
                setSymptomType(selectedType);
                setFormError("");
                setSuccess("");
              }}
              className="mt-1 h-9 w-full rounded-xl border border-[#eadcf4] bg-white px-2 text-xs font-normal text-ink outline-none placeholder:text-ink/45 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
            >
              <option value="" disabled>Select a symptom type</option>
              {CYCLE_SYMPTOM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatSymptomType(type)}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-ink/80">Severity (1–5)</legend>
            <div className="mt-1 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Symptom severity">
              {[1, 2, 3, 4, 5].map((level) => {
                const active = severity === String(level);
                return (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSeverity(String(level));
                      setFormError("");
                      setSuccess("");
                    }}
                    className={`grid min-h-9 place-items-center rounded-xl border text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                      active
                        ? "border-brand-purple bg-lavender text-brand-purple"
                        : "border-[#eadcf4] bg-white text-ink/70 hover:bg-blush"
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-xs font-semibold text-ink/80" htmlFor="symptom-recorded-on">
            Recorded date
            <input
              id="symptom-recorded-on"
              type="date"
              required
              value={recordedOn}
              onChange={(event) => {
                setRecordedOn(event.target.value);
                setFormError("");
                setSuccess("");
              }}
              className="mt-1 h-9 w-full rounded-xl border border-[#eadcf4] bg-white px-2 text-xs font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
            />
          </label>

          <label className="block text-xs font-semibold text-ink/80" htmlFor="symptom-notes">
            Notes <span className="font-normal text-ink/50">(optional)</span>
            <textarea
              id="symptom-notes"
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setFormError("");
                setSuccess("");
              }}
              rows={1}
              className="mt-1 w-full resize-y rounded-xl border border-[#eadcf4] bg-white px-2 py-10  text-xs font-normal leading-4 text-ink outline-none placeholder:text-ink/45 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
              placeholder="Add any details you want to remember..."
            />
          </label>

          <button
            type="submit"
            disabled={
              saving ||
              cyclesLoading ||
              cycles.length === 0 ||
              Boolean(cyclesError) ||
              symptomsLoading ||
              Boolean(symptomsError)
            }
            className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white shadow-[0_4px_8px_rgba(74,38,103,0.2)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
            {saving ? "Saving symptom..." : "Save symptom"}
          </button>
          <p
            className={`min-h-5 text-center text-xs ${formError ? "text-red-700" : "text-brand-purple"}`}
            role={formError ? "alert" : "status"}
            aria-live="polite"
          >
            {formError || success}
          </p>
        </form>
      </section>

      <section className="rounded-3xl border border-[#eadcf4] bg-white p-3 shadow-[0_3px_12px_rgba(80,43,108,0.04)] sm:p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Symptom history
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setSymptomsLoading(true);
              setSymptomsError("");
              setSymptomsRetry((retry) => retry + 1);
            }}
            disabled={symptomsLoading}
            className="shrink-0 rounded-full border border-brand-purple/25 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {selectedSymptomId && (
          <div className="mt-5 rounded-2xl border border-brand-purple/20 bg-[linear-gradient(145deg,#fff,#fcf8ff)] p-4" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-bold text-ink">Symptom details</h4>
              <button
                type="button"
                onClick={() => {
                  setSelectedSymptomId(null);
                  setSymptomDetail(null);
                  setDetailError("");
                  setDetailLoading(false);
                }}
                className="text-xs font-semibold text-brand-purple underline underline-offset-2"
              >
                Close
              </button>
            </div>
            {detailLoading ? (
              <p className="mt-3 text-sm text-ink/60" role="status">Loading symptom details...</p>
            ) : detailError ? (
              <div className="mt-3 text-sm text-red-800" role="alert">
                <p>{detailError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setDetailLoading(true);
                    setDetailError("");
                    setDetailRetry((retry) => retry + 1);
                  }}
                  className="mt-2 font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : symptomDetail ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-ink/50">Symptom</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatSymptomType(symptomDetail.symptomType)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink/50">Severity</dt>
                  <dd className="mt-1 font-semibold text-ink">{symptomDetail.severity} / 5</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink/50">Cycle</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {cycleLabel(cycles, symptomDetail.cycleId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink/50">Recorded date</dt>
                  <dd className="mt-1 font-semibold text-ink">
                    {formatRecordedDate(symptomDetail.recordedOn)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-ink/50">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-ink/75">
                    {symptomDetail.notes || "No notes added."}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        )}

        <div className="mt-5">
          {symptomsLoading ? (
            <div className="flex min-h-36 items-center justify-center gap-3 text-sm text-brand-purple/75" role="status">
              <span className="size-5 animate-spin rounded-full border-2 border-brand-purple/20 border-t-brand-purple" aria-hidden="true" />
              Loading symptom history...
            </div>
          ) : symptomsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
              <p>{symptomsError}</p>
              <button
                type="button"
                onClick={() => setSymptomsRetry((retry) => retry + 1)}
                className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Try again
              </button>
            </div>
          ) : symptoms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9c8e5] bg-[#fcf9fe] px-5 py-10 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-lavender/60 text-brand-purple" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className="size-5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <p className="mt-4 text-sm font-semibold text-ink">No symptoms recorded yet</p>
              <p className="mt-1 text-xs text-ink/60">Your saved symptom history will appear here.</p>
            </div>
          ) : (
            <ul className="max-h-[32dvh] space-y-3 overflow-y-auto pr-1">
              {symptoms.map((symptom) => {
                const isOpen = selectedSymptomId === symptom.id;
                return (
                  <li key={symptom.id} className="rounded-2xl border border-[#eadcf4] bg-[linear-gradient(145deg,#fff,#fcf8ff)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold text-ink">
                          {formatSymptomType(symptom.symptomType)}
                        </h3>
                        <time
                          className="mt-1 block text-xs text-ink/55"
                          dateTime={symptom.recordedOn}
                        >
                          {formatRecordedDate(symptom.recordedOn)}
                        </time>
                      </div>
                      <span className="shrink-0 rounded-full bg-brand-pink/10 px-3 py-1 text-xs font-semibold text-brand-purple">
                        {symptom.severity} / 5
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-ink/55">
                      {cycleLabel(cycles, symptom.cycleId)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-ink/70">
                      {symptom.notes || "No notes added."}
                    </p>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                        onClick={() => {
                          if (isOpen) {
                            setSelectedSymptomId(null);
                            setSymptomDetail(null);
                            setDetailError("");
                            setDetailLoading(false);
                          } else {
                            setSelectedSymptomId(symptom.id);
                            setSymptomDetail(null);
                            setDetailError("");
                            setDetailLoading(true);
                          }
                        }}
                      className="mt-3 text-xs font-semibold text-brand-purple underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                    >
                      {isOpen ? "Hide details" : "View details"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
