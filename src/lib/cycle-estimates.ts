import type { MenstrualCycle } from "@/lib/api/cycle-symptoms";

/* Shared cycle estimates (used by the Cycle view and the Calendar). */

export function dateDayNumber(value: string): number | null {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 86_400_000);
}

export function dateFromDayNumber(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

/** Average recorded period length in days, or null without complete cycles. */
export function averagePeriodDuration(cycles: MenstrualCycle[]): number | null {
  const durations = cycles.flatMap((cycle) => {
    const start = dateDayNumber(cycle.startDate);
    const end = dateDayNumber(cycle.endDate);
    return start !== null && end !== null && end >= start ? [end - start + 1] : [];
  });
  return durations.length
    ? Math.round(durations.reduce((sum, duration) => sum + duration, 0) / durations.length)
    : null;
}

/** Average cycle length and next start date from at least two recorded starts. */
export function estimateNextPeriod(cycles: MenstrualCycle[]): {
  averageCycleLength: number;
  nextStartDate: string;
} | null {
  const startsByDay = new Map<number, string>();
  for (const cycle of cycles) {
    const date = cycle.startDate.slice(0, 10);
    const day = dateDayNumber(date);
    if (day !== null) startsByDay.set(day, date);
  }
  const starts = Array.from(startsByDay, ([day, date]) => ({ day, date }))
    .sort((left, right) => left.day - right.day);
  if (starts.length < 2) return null;

  const intervals = starts.slice(1).map((current, index) => current.day - starts[index].day);
  const averageCycleLength = Math.round(
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
  );
  const latestStart = starts[starts.length - 1];
  return {
    averageCycleLength,
    nextStartDate: dateFromDayNumber(latestStart.day + averageCycleLength),
  };
}
