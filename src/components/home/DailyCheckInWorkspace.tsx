"use client";

import { useCallback, useState } from "react";
import DailyCheckInHistory from "@/components/home/DailyCheckInHistory";
import MoodCheckIn from "@/components/home/MoodCheckIn";

export default function DailyCheckInWorkspace() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  return (
    <div>
      <div className="mx-auto w-full max-w-3xl">
        <MoodCheckIn
          onCreated={() => setRefreshKey((key) => key + 1)}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      </div>
      {historyOpen && (
        <DailyCheckInHistory
          key={refreshKey}
          refreshKey={refreshKey}
          onClose={closeHistory}
        />
      )}
    </div>
  );
}
