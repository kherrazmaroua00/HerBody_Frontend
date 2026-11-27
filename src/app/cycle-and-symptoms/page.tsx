import AppPageHeading from "@/components/ui/AppPageHeading";
import CycleTrackingWorkspace from "@/components/cycle/CycleTrackingWorkspace";

export default function CycleAndSymptomsPage() {
  return (
    <main className="mx-auto flex h-[calc(100dvh-3.5rem)] min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 py-3 sm:px-6 lg:h-dvh lg:px-8 lg:py-5">
      <div className="shrink-0">
        <AppPageHeading
          icon="cycle"
          eyebrow="Your personal tracker"
          title="Cycle and symptoms"
          description="Record cycle dates and symptoms to track patterns over time."
          compact
        />
      </div>
      <CycleTrackingWorkspace />
    </main>
  );
}
