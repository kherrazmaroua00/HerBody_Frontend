"use client";

import { useState, type FormEvent } from "react";
import {
  createDailyCheckin,
  DAILY_CHECKIN_MOODS,
  type DailyCheckinMood,
} from "@/lib/api/check-ins";
import CheckInMoodIcon, { CHECKIN_MOOD_LABELS } from "@/components/home/CheckInMoodIcon";

export default function MoodCheckIn({
  compact = false,
  onCreated,
  onOpenHistory,
}: {
  compact?: boolean;
  onCreated?: () => void;
  onOpenHistory?: () => void;
}) {
  const [selectedMood, setSelectedMood] = useState<DailyCheckinMood | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);

  async function saveCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMood) return;
    if (selectedMood === "other" && !note.trim()) {
      setError("Please describe your mood in the note.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await createDailyCheckin({
        mood: selectedMood,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSelectedMood(null);
      setNote("");
      setAlreadyCheckedIn(true);
      setSuccess("Your check-in is saved. You can review it in your history.");
      onCreated?.();
    } catch (requestError) {
      if (
        requestError instanceof Error &&
        "kind" in requestError &&
        requestError.kind === "conflict"
      ) {
        setAlreadyCheckedIn(true);
        setSuccess("You already have a check-in today. You can review it in your history.");
        onCreated?.();
      } else {
        setError(requestError instanceof Error ? requestError.message : "Unable to save your check-in.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`rounded-3xl border border-[#eadcf4] bg-white shadow-[0_3px_12px_rgba(80,43,108,0.04)] ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-brand-pink/20 bg-brand-pink/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
            Today&apos;s pulse
          </span>
          <h2 className={`font-bold tracking-tight text-ink ${compact ? "mt-2 text-base" : "mt-3 text-xl sm:text-2xl"}`}>
            How are you feeling today?
          </h2>
          <p className={`mt-1 leading-5 text-ink/60 ${compact ? "text-xs" : "text-sm"}`}>
            Choose the emotion that feels closest. You can add a note if you&apos;d like.
          </p>
        </div>
        {onOpenHistory ? (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-haspopup="dialog"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-brand-purple/25 bg-white px-4 text-xs font-semibold text-brand-purple transition hover:bg-lavender/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
              <path d="M3 3v5h5m4-1v5l3 2" />
            </svg>
            Check-in history
          </button>
        ) : (
          <span className={`grid shrink-0 place-items-center rounded-full bg-brand-pink/10 text-brand-pink ${compact ? "size-9" : "size-11"}`}>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={compact ? "size-4" : "size-5"}
          >
            <path d="M20.8 8.6c0 5.2-8.8 10-8.8 10S3.2 13.8 3.2 8.6a4.4 4.4 0 0 1 8.8-0.2 4.4 4.4 0 0 1 8.8.2Z" />
          </svg>
          </span>
        )}
      </div>

      <form className="mt-4" onSubmit={saveCheckIn}>
        <div className={`grid grid-cols-2 sm:grid-cols-3 ${compact ? "gap-1.5" : "gap-2"}`} role="group" aria-label="Choose your mood">
          {DAILY_CHECKIN_MOODS.map((mood) => {
            const active = selectedMood === mood;
            return (
              <button
                key={mood}
                type="button"
                disabled={loading || alreadyCheckedIn}
                aria-pressed={active}
                onClick={() => {
                  setSelectedMood(mood);
                  setError("");
                  setSuccess("");
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-2.5 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-60 ${
                  compact ? "min-h-9 text-xs" : "min-h-10 px-3 text-sm"
                } ${
                  active
                    ? "border-brand-pink bg-brand-pink/10 text-brand-purple"
                    : "border-[#eadcf4] bg-white text-ink/75 hover:border-brand-pink/50 hover:bg-blush"
                }`}
              >
                <CheckInMoodIcon mood={mood} className={`shrink-0 ${compact ? "size-4" : "size-5"}`} />
                {CHECKIN_MOOD_LABELS[mood]}
              </button>
            );
          })}
        </div>

        <label className={`block font-semibold text-ink/75 ${compact ? "mt-3 text-xs" : "mt-4 text-sm"}`} htmlFor={compact ? "home-check-in-note" : "daily-check-in-note"}>
          {selectedMood === "other" ? "Describe your mood" : "Note (optional)"}
          {selectedMood === "other" && <span className="text-brand-pink"> *</span>}
        </label>
        <textarea
          id={compact ? "home-check-in-note" : "daily-check-in-note"}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setError("");
            setSuccess("");
          }}
          disabled={loading || alreadyCheckedIn}
          maxLength={500}
          required={selectedMood === "other"}
          placeholder={selectedMood === "other" ? "Tell us what you are feeling..." : "Add a note if you want to share more..."}
          rows={compact ? 2 : 3}
          className={`mt-2 w-full resize-y rounded-xl border border-[#eadcf4] bg-white text-ink outline-none placeholder:text-ink/45 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15 ${
            compact ? "px-3 py-2 text-xs leading-5" : "px-4 py-2 text-sm leading-6"
          }`}
        />
        <p className={`mt-1 text-right text-ink/50 ${compact ? "text-[10px]" : "text-xs"}`}>{note.length}/500</p>

        <button
          type="submit"
          disabled={!selectedMood || loading || alreadyCheckedIn || (selectedMood === "other" && !note.trim())}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-4 font-semibold text-white shadow-[0_4px_8px_rgba(74,38,103,0.2)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "mt-2 h-9 text-xs" : "mt-1 h-11 text-sm"}`}
        >
          {loading && <span className={`animate-spin rounded-full border-2 border-white/40 border-t-white ${compact ? "size-4" : "size-5"}`} aria-hidden="true" />}
          {loading ? "Saving..." : alreadyCheckedIn ? "Already checked in today" : "Save my check-in"}
        </button>
        <p className={`min-h-5 text-center ${compact ? "mt-1 text-[11px]" : "mt-2 text-xs"} ${error ? "text-red-700" : "text-brand-purple"}`} role={error ? "alert" : "status"} aria-live="polite">
          {error || success}
        </p>
      </form>
    </section>
  );
}
