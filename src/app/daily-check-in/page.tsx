import DailyCheckInWorkspace from "@/components/home/DailyCheckInWorkspace";
import AppPageHeading from "@/components/ui/AppPageHeading";

export default function DailyCheckInPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="checkin"
        eyebrow="A moment for you"
        title="Daily check-in"
        description="Notice how you feel, save a note if you want, and revisit your check-in history whenever you need."
      />
      <DailyCheckInWorkspace />
    </main>
  );
}
