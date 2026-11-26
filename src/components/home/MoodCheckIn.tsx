"use client";

import { useState } from "react";

const moods = [
  { id: "happy", label: "Happy", face: "M7.5 14.5c1.2 1.4 2.7 2.1 4.5 2.1s3.3-.7 4.5-2.1" },
  { id: "calm", label: "Calm", face: "M8 14.5h8" },
  { id: "energetic", label: "Energetic", face: "M7.5 14c1.2 1.5 2.7 2.3 4.5 2.3s3.3-.8 4.5-2.3" },
  { id: "tired", label: "Tired", face: "M8 15h8" },
  { id: "anxious", label: "Anxious", face: "M8 15c1.2-1 2.8-1 4 0s2.8 1 4 0" },
  { id: "sad", label: "Sad", face: "M8 16c1-1.6 2.3-2.4 4-2.4s3 .8 4 2.4" },
] as const;

function MoodFace({ mood }: { mood: (typeof moods)[number]["id"] }) {
  const eyes =
    mood === "tired" ? (
      <>
        <path d="M7.5 10h2.5M14 10h2.5" />
      </>
    ) : mood === "anxious" ? (
      <>
        <circle cx="8.5" cy="10" r="1" />
        <circle cx="15.5" cy="10" r="1" />
      </>
    ) : (
      <>
        <circle cx="8.5" cy="10" r="0.8" />
        <circle cx="15.5" cy="10" r="0.8" />
      </>
    );

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      {eyes}
      <path d={moods.find((item) => item.id === mood)?.face} />
    </svg>
  );
}

export default function MoodCheckIn({ compact = false }: { compact?: boolean }) {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  function saveCheckIn() {
    if (!selectedMood) return;
    setSaved(true);
  }

  return (
    <section className={`rounded-3xl border border-[#eadcf4] bg-white shadow-[0_3px_12px_rgba(80,43,108,0.04)] ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full border border-brand-pink/20 bg-brand-pink/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
            Today&apos;s pulse
          </span>
          <h2 className={`font-bold tracking-tight text-ink ${compact ? "mt-2 text-base" : "mt-3 text-lg"}`}>
            How are you feeling today?
          </h2>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-pink/10 text-brand-pink">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M20.8 8.6c0 5.2-8.8 10-8.8 10S3.2 13.8 3.2 8.6a4.4 4.4 0 0 1 8.8-0.2 4.4 4.4 0 0 1 8.8.2Z" />
          </svg>
        </span>
      </div>

      <div className={`grid grid-cols-3 ${compact ? "mt-3 gap-1.5" : "mt-4 gap-2"}`} role="group" aria-label="Choose your mood">
        {moods.map((mood) => {
          const active = selectedMood === mood.id;
          return (
            <button
              key={mood.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelectedMood(mood.id);
                setSaved(false);
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
                compact ? "min-h-9" : "min-h-10"
              } ${
                active
                  ? "border-brand-pink bg-brand-pink/10 text-brand-purple"
                  : "border-[#eadcf4] bg-white text-ink/75 hover:border-brand-pink/50 hover:bg-blush"
              }`}
            >
              <MoodFace mood={mood.id} />
              {mood.label}
            </button>
          );
        })}
      </div>

      <label className="sr-only" htmlFor="daily-check-in-note">
        Add a note about how you feel
      </label>
      <input
        id="daily-check-in-note"
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          setSaved(false);
        }}
        maxLength={240}
        placeholder="Or write here..."
        className={`w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-xs text-ink outline-none placeholder:text-ink/55 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15 ${compact ? "mt-2 h-9" : "mt-2.5 h-10"}`}
      />

      <button
        type="button"
        onClick={saveCheckIn}
        disabled={!selectedMood}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-4 text-xs font-semibold text-white shadow-[0_4px_8px_rgba(74,38,103,0.2)] transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50 ${compact ? "mt-2.5 h-9" : "mt-3 h-10"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M20.8 8.6c0 5.2-8.8 10-8.8 10S3.2 13.8 3.2 8.6a4.4 4.4 0 0 1 8.8-.2 4.4 4.4 0 0 1 8.8.2Z" />
        </svg>
        {saved ? "Check-in saved" : "Save my check-in"}
      </button>
      <p className={`min-h-4 text-center text-[11px] text-brand-purple ${compact ? "mt-1" : "mt-2"}`} role="status" aria-live="polite">
        {saved ? "Your check-in is saved for this session." : ""}
      </p>
    </section>
  );
}
