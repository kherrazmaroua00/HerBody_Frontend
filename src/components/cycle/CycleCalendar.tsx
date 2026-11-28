"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { CycleSymptom, MenstrualCycle } from "@/lib/api/cycle-symptoms";
import { useWeekStartsOn } from "@/lib/preferences";

/* ---------------- Date helpers (calendar days as UTC day numbers) ---------------- */

const DAY_MS = 86_400_000;

export function dayNumber(value: string): number | null {
  const time = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(time) ? null : Math.floor(time / DAY_MS);
}

export function isoFromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Today's local date as a day number. Read in the browser only (never during prerender). */
function todayDay(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}
const noSubscription = () => () => {};
const serverToday = () => null;

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ---------------- Day classification ---------------- */

/** Days of the luteal phase (ovulation to next period) used for the usual estimate. */
const LUTEAL_DAYS = 14;
/** Fertile window: the five days before ovulation and ovulation day. */
const FERTILE_DAYS_BEFORE = 5;
/** How many future cycles are projected from the average cycle length. */
const PROJECTED_CYCLES = 3;

export type DayKind = "period" | "predicted" | "fertile";

export interface DayInfo {
  kind: DayKind | null;
  ovulation: boolean;
  /** Day of the cycle (1 = first day of the period), when a cycle start precedes it. */
  cycleDay: number | null;
}

interface CalendarModel {
  info: (day: number) => DayInfo;
  hasEstimates: boolean;
  /** First period start (recorded or predicted) after `day`. */
  nextPeriodAfter: (day: number) => number | null;
  /** First estimated ovulation on or after `day`. */
  nextOvulationFrom: (day: number) => number | null;
}

export function buildCycleModel(cycles: MenstrualCycle[], averageCycleLength: number | null, averagePeriodLength: number | null): CalendarModel {
  const kinds = new Map<number, DayKind>();
  const ovulations = new Set<number>();
  const mark = (day: number, kind: DayKind) => {
    const current = kinds.get(day);
    // A recorded period wins over a prediction, which wins over the fertile window.
    const rank = { period: 3, predicted: 2, fertile: 1 } as const;
    if (!current || rank[kind] > rank[current]) kinds.set(day, kind);
  };

  const recorded = cycles
    .flatMap((cycle) => {
      const start = dayNumber(cycle.startDate);
      const end = dayNumber(cycle.endDate);
      return start === null ? [] : [{ start, end: end !== null && end >= start ? end : start }];
    })
    .sort((a, b) => a.start - b.start);

  for (const { start, end } of recorded) {
    for (let day = start; day <= end; day += 1) mark(day, "period");
  }

  const starts = [...new Set(recorded.map((cycle) => cycle.start))];
  const predictedStarts: number[] = [];
  if (averageCycleLength && starts.length >= 2) {
    const periodLength = Math.max(1, averagePeriodLength ?? 5);
    let next = starts[starts.length - 1] + averageCycleLength;
    for (let i = 0; i < PROJECTED_CYCLES; i += 1, next += averageCycleLength) {
      predictedStarts.push(next);
      for (let day = next; day < next + periodLength; day += 1) mark(day, "predicted");
    }
  }

  // Ovulation is estimated 14 days before each following period start (recorded or predicted).
  const allStarts = [...starts, ...predictedStarts];
  for (let i = 1; i < allStarts.length; i += 1) {
    const ovulation = allStarts[i] - LUTEAL_DAYS;
    if (ovulation <= allStarts[i - 1]) continue;
    ovulations.add(ovulation);
    for (let day = ovulation - FERTILE_DAYS_BEFORE; day <= ovulation; day += 1) {
      if (day > allStarts[i - 1]) mark(day, "fertile");
    }
  }

  const sortedOvulations = [...ovulations].sort((a, b) => a - b);
  return {
    hasEstimates: predictedStarts.length > 0 || ovulations.size > 0,
    nextPeriodAfter: (day) => allStarts.find((start) => start > day) ?? null,
    nextOvulationFrom: (day) => sortedOvulations.find((ovulation) => ovulation >= day) ?? null,
    info(day) {
      let cycleStart: number | null = null;
      for (const start of allStarts) {
        if (start <= day && (cycleStart === null || start > cycleStart)) cycleStart = start;
      }
      const cycleDay = cycleStart === null ? null : day - cycleStart + 1;
      return {
        kind: kinds.get(day) ?? null,
        ovulation: ovulations.has(day) && kinds.get(day) !== "period",
        cycleDay: cycleDay !== null && cycleDay <= 60 ? cycleDay : null,
      };
    },
  };
}

const KIND_STYLE: Record<DayKind, string> = {
  period: "bg-[#f6b9c3]",
  predicted: "bg-[#fde6ea] [background-image:repeating-linear-gradient(135deg,transparent_0_6px,rgba(237,85,120,0.13)_6px_8px)]",
  fertile: "bg-[#c3c9f5]",
};

export const KIND_LABEL: Record<DayKind, string> = {
  period: "period day",
  predicted: "estimated period day",
  fertile: "estimated fertile window",
};

/* ---------------- Component ---------------- */

const navButton =
  "grid size-8 place-items-center rounded-full text-lg leading-none text-ink/55 transition hover:bg-white hover:text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple";

function daysLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function SummaryChip({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-white px-2.5 py-2 shadow-[0_1px_4px_rgba(80,43,108,0.06)] sm:px-3">
      <p className="flex items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.06em] text-ink/45 sm:text-[10px]">
        <i className={`inline-block size-2 shrink-0 rounded-full ${tone}`} />
        {label}
      </p>
      <p className="mt-0.5 break-words text-[13px] font-bold leading-tight text-ink sm:text-sm">{value}</p>
    </div>
  );
}

export default function CycleCalendar({
  cycles,
  symptoms = [],
  averageCycleLength,
  averagePeriodLength,
  selectedDate,
  onSelectDate,
}: {
  cycles: MenstrualCycle[];
  /** Logged symptoms; days with one get a dot. */
  symptoms?: CycleSymptom[];
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  /** Date shown as selected (YYYY-MM-DD), e.g. the start date in the log form. */
  selectedDate?: string;
  /** Called with YYYY-MM-DD when a day is clicked. */
  onSelectDate?: (date: string) => void;
}) {
  const today = useSyncExternalStore<number | null>(noSubscription, todayDay, serverToday);
  /** Months away from the current month (0 = this month). */
  const [offset, setOffset] = useState(0);
  /** Settings → Week starts on (0 = Sunday, 1 = Monday). */
  const weekStart = useWeekStartsOn();
  const model = useMemo(
    () => buildCycleModel(cycles, averageCycleLength, averagePeriodLength),
    [cycles, averageCycleLength, averagePeriodLength],
  );
  const selected = selectedDate ? dayNumber(selectedDate) : null;
  const symptomCount = useMemo(() => {
    const counts = new Map<number, number>();
    for (const symptom of symptoms) {
      const day = dayNumber(symptom.recordedOn);
      if (day !== null) counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [symptoms]);

  if (today === null) {
    return (
      <section aria-label="Cycle calendar" className="rounded-3xl bg-[#fdf1f5] p-4 text-xs text-ink/55" role="status">
        Loading calendar…
      </section>
    );
  }

  const todayDate = new Date(today * DAY_MS);
  const shown = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + offset, 1));
  const first = Math.floor(shown.getTime() / DAY_MS);
  const daysInMonth = new Date(Date.UTC(shown.getUTCFullYear(), shown.getUTCMonth() + 1, 0)).getUTCDate();
  const leading = (shown.getUTCDay() - weekStart + 7) % 7;
  const weekdayOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStart) % 7);
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => first + i),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const title = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(shown);
  const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

  const todayInfo = model.info(today);
  const nextPeriod = model.nextPeriodAfter(today);
  const nextOvulation = model.nextOvulationFrom(today);

  return (
    <section aria-label="Cycle calendar" className="rounded-3xl bg-[#fdf1f5] p-3 sm:p-4">
      <div className="flex gap-2">
        <SummaryChip
          label="Today"
          tone="bg-brand-pink"
          value={todayInfo.cycleDay ? `Cycle day ${todayInfo.cycleDay}` : "—"}
        />
        <SummaryChip
          label="Next period"
          tone="bg-[#f6b9c3]"
          value={todayInfo.kind === "period" ? "On period" : nextPeriod !== null ? daysLabel(nextPeriod - today) : "—"}
        />
        <SummaryChip
          label="Ovulation est."
          tone="bg-[#f6d55c]"
          value={nextOvulation !== null ? shortDate.format(nextOvulation * DAY_MS) : "—"}
        />
      </div>

      <div className="mt-3 rounded-2xl bg-white/70 px-2 pb-2 pt-1.5 sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setOffset((value) => value - 1)} className={navButton}>‹</button>
          <p className="text-sm font-bold text-ink" aria-live="polite">{title}</p>
          <div className="flex items-center">
            {offset !== 0 && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="rounded-full px-2 py-1 text-[11px] font-semibold text-brand-pink transition hover:bg-brand-pink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-pink"
              >
                Today
              </button>
            )}
            <button type="button" aria-label="Next month" onClick={() => setOffset((value) => value + 1)} className={navButton}>›</button>
          </div>
        </div>

        <table className="mt-1 w-full table-fixed border-collapse" role="grid" aria-label={title}>
          <thead>
            <tr>
              {weekdayOrder.map((i) => (
                <th key={WEEKDAY_NAMES[i]} scope="col" abbr={WEEKDAY_NAMES[i]} className="pb-1 text-center text-[10px] font-semibold uppercase text-ink/40">
                  {WEEKDAYS[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, row) => (
              <tr key={row}>
                {week.map((day, column) => {
                  if (day === null) return <td key={column} />;
                  const info = model.info(day);
                  const previous = column > 0 && week[column - 1] !== null ? model.info(week[column - 1]!).kind : null;
                  const next = column < 6 && week[column + 1] !== null ? model.info(week[column + 1]!).kind : null;
                  const roundLeft = info.kind && previous !== info.kind;
                  const roundRight = info.kind && next !== info.kind;
                  const isToday = day === today;
                  const isSelected = day === selected;
                  const isPast = day < today;
                  const label = [
                    longDate.format(day * DAY_MS),
                    info.kind ? KIND_LABEL[info.kind] : null,
                    info.ovulation ? "estimated ovulation" : null,
                    info.cycleDay ? `cycle day ${info.cycleDay}` : null,
                    symptomCount.get(day) ? `${symptomCount.get(day)} symptom${symptomCount.get(day) === 1 ? "" : "s"} logged` : null,
                    isToday ? "today" : null,
                  ].filter(Boolean).join(", ");

                  return (
                    <td key={column} className="py-[3px]">
                      <div
                        className={`flex h-10 items-center justify-center ${info.kind ? KIND_STYLE[info.kind] : ""} ${
                          roundLeft ? "rounded-l-full" : ""
                        } ${roundRight ? "rounded-r-full" : ""}`}
                      >
                        <button
                          type="button"
                          aria-label={label}
                          aria-pressed={isSelected}
                          onClick={() => onSelectDate?.(isoFromDay(day))}
                          className={`relative flex size-9 flex-col items-center justify-center rounded-full leading-none transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-purple ${
                            info.ovulation ? "bg-[#f9df7b] shadow-[0_0_0_3px_rgba(249,223,123,0.35)]" : "hover:bg-white"
                          } ${isSelected ? "!bg-brand-purple text-white" : isToday ? "bg-white ring-2 ring-brand-pink" : ""}`}
                        >
                          <span
                            className={`text-[13px] ${
                              isSelected ? "font-bold text-white" : isToday ? "font-bold text-brand-pink" : isPast && !info.kind ? "font-medium text-ink/55" : "font-semibold text-ink"
                            }`}
                          >
                            {new Date(day * DAY_MS).getUTCDate()}
                          </span>
                          <span className={`mt-0.5 h-2.5 text-[8.5px] ${isSelected ? "text-white/75" : "text-ink/40"}`}>
                            {info.cycleDay ?? ""}
                          </span>
                          {symptomCount.get(day) ? (
                            <span
                              aria-hidden="true"
                              className="absolute -right-0.5 -top-0.5 grid min-w-3.5 place-items-center rounded-full border-2 border-white bg-brand-purple px-0.5 text-[8px] font-bold leading-[10px] text-white"
                            >
                              {symptomCount.get(day)! > 1 ? symptomCount.get(day) : ""}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-ink/65 sm:flex sm:flex-wrap sm:gap-x-4">
        <li className="flex items-center gap-1.5"><i className={`inline-block h-2.5 w-4 rounded-full ${KIND_STYLE.period}`} />Period</li>
        <li className="flex items-center gap-1.5"><i className={`inline-block h-2.5 w-4 rounded-full ${KIND_STYLE.predicted}`} />Predicted period</li>
        <li className="flex items-center gap-1.5"><i className={`inline-block h-2.5 w-4 rounded-full ${KIND_STYLE.fertile}`} />Fertile window</li>
        <li className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-[#f9df7b]" />Ovulation</li>
        <li className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-full bg-brand-purple" />Symptom logged</li>
      </ul>
      <p className="mt-2 text-[10.5px] leading-4 text-ink/50">
        {model.hasEstimates
          ? "Predictions, fertile window and ovulation are estimates from your average cycle, not medical advice or contraception."
          : "Log at least two periods to see predictions, fertile window and ovulation."}{" "}
        Tap a day to see its details. Small numbers are cycle days.
      </p>
    </section>
  );
}
