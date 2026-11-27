"use client";

import { useEffect, useState } from "react";
import { getDailyCheckins, type DailyCheckin } from "@/lib/api/check-ins";
import CheckInMoodIcon, { CHECKIN_MOOD_LABELS } from "@/components/home/CheckInMoodIcon";

function formatCheckinDate(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatMood(mood: DailyCheckin["mood"]): string {
  return mood === "other" ? "Other mood" : CHECKIN_MOOD_LABELS[mood];
}

function formatTime(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function DailyCheckInHistory({
  refreshKey,
  onClose,
}: {
  refreshKey: number;
  onClose: () => void;
}) {
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function retryHistory() {
    setLoading(true);
    setError("");
    try {
      setCheckins(await getDailyCheckins());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load your check-in history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    void getDailyCheckins()
      .then((records) => {
        if (active) setCheckins(records);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load your check-in history.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close check-in history"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-ink/35 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-history-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#eadcf4] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eadcf4] bg-[linear-gradient(135deg,#fff7fc,#f8f2ff)] p-5 sm:p-6">
          <div>
            <span className="inline-flex rounded-full border border-brand-purple/10 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-purple">
              Your journey
            </span>
            <h2 id="checkin-history-title" className="mt-3 text-xl font-bold tracking-tight text-ink">
              Check-in history
            </h2>
            <p className="mt-1 text-sm leading-5 text-ink/60">
              Your saved check-ins, all in one place.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close check-in history"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-[#eadcf4] bg-white text-ink/65 transition hover:bg-lavender/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-4">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="flex min-h-36 items-center justify-center gap-3 text-sm text-brand-purple/75" role="status">
              <span className="size-5 animate-spin rounded-full border-2 border-brand-purple/20 border-t-brand-purple" aria-hidden="true" />
              Loading your check-ins...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800" role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void retryHistory()}
                className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Try again
              </button>
            </div>
          ) : checkins.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#d9c8e5] bg-[#fcf9fe] px-5 py-10 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-lavender/60 text-brand-purple">
                <CheckInMoodIcon mood="other" className="size-6" />
              </span>
              <p className="mt-4 text-base font-semibold text-ink">No check-ins yet</p>
              <p className="mt-1 text-sm text-ink/60">Your saved check-ins will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {checkins.map((checkin) => (
                <li key={checkin.id} className="rounded-2xl border border-[#eadcf4] bg-[linear-gradient(145deg,#fff,#fcf8ff)] p-4 shadow-[0_2px_8px_rgba(80,43,108,0.04)]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-pink/10 text-brand-purple">
                      <CheckInMoodIcon mood={checkin.mood} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-ink">{formatMood(checkin.mood)}</h3>
                      <time className="mt-1 block text-xs text-ink/55" dateTime={checkin.checkinDate}>
                        {formatCheckinDate(checkin.checkinDate)}
                      </time>
                      {formatTime(checkin.createdAt) && (
                        <p className="mt-0.5 text-xs text-ink/50">
                          Recorded at {formatTime(checkin.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-lavender/25 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink/50">
                      {checkin.mood === "other" ? "Mood description" : "Note"}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ink/75">
                      {checkin.note || "No note added."}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

    </>
  );
}
