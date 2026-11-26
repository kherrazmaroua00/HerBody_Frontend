import MoodCheckIn from "@/components/home/MoodCheckIn";
import AppPageHeading from "@/components/ui/AppPageHeading";

export default function DailyCheckInPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="checkin"
        eyebrow="A moment for you"
        title="Daily check-in"
        description="Take a moment to notice how you feel. Your check-in stays in this session."
      />
      <div className="max-w-2xl">
        <MoodCheckIn />
      </div>
    </main>
  );
}
