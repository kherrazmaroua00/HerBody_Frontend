import type { ReactNode } from "react";
import type { DailyCheckinMood } from "@/lib/api/check-ins";

export const CHECKIN_MOOD_LABELS: Record<DailyCheckinMood, string> = {
  anxiety: "Anxiety",
  loneliness: "Loneliness",
  sadness: "Sadness",
  desperate: "Desperate",
  happiness: "Happiness",
  gratitude: "Gratitude",
  anger: "Anger",
  injustice: "Injustice",
  other: "Other",
};

export default function CheckInMoodIcon({ mood, className = "size-5" }: {
  mood: DailyCheckinMood;
  className?: string;
}) {
  const face = (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="10" r="0.7" fill="currentColor" />
      <circle cx="15" cy="10" r="0.7" fill="currentColor" />
    </>
  );

  let expression: ReactNode;
  switch (mood) {
    case "anxiety":
      expression = <><path d="M8 7.5 9.5 6M16 7.5 14.5 6" /><path d="M8.5 15c1-1 1.8 1 2.8 0s1.8 1 2.8 0 1.8 1 2.8 0" /></>;
      break;
    case "loneliness":
      expression = <><path d="M9 15.5c1.8-1.6 4.2-1.6 6 0" /><path d="M18 11.5c1.8 2.2 1.5 3.8 0 4.5-1.5-.7-1.8-2.3 0-4.5Z" /></>;
      break;
    case "sadness":
      expression = <path d="M8.5 16c1.8-2.2 5.2-2.2 7 0" />;
      break;
    case "desperate":
      expression = <><path d="m8 7.5 2 1M16 7.5l-2 1" /><ellipse cx="12" cy="15.5" rx="2" ry="1.5" /></>;
      break;
    case "happiness":
      expression = <path d="M8.5 14c1.8 2.8 5.2 2.8 7 0" />;
      break;
    case "gratitude":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 20s-7-4.2-7-9a3.7 3.7 0 0 1 7-1.6A3.7 3.7 0 0 1 19 11c0 4.8-7 9-7 9Z" />
          <path d="M12 2v2M4.2 4.2l1.4 1.4M19.8 4.2l-1.4 1.4" />
        </svg>
      );
    case "anger":
      expression = <><path d="m7.5 8.5 3 1M16.5 8.5l-3 1" /><path d="M9 16c1.5-1.3 4.5-1.3 6 0" /></>;
      break;
    case "injustice":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <path d="M12 4v15M8 20h8M5 7h14M12 4l-7 3m7-3 7 3M5 7l-3 6h6L5 7Zm14 0-3 6h6l-3-6Z" />
          <path d="M2 13c.4 1.4 1.4 2 3 2s2.6-.6 3-2m8 0c.4 1.4 1.4 2 3 2s2.6-.6 3-2" />
        </svg>
      );
    case "other":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {face}
      {expression}
    </svg>
  );
}
