import Link from "next/link";
import AppPageHeading from "@/components/ui/AppPageHeading";

export default function LabResultsPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="labs"
        eyebrow="Your health records"
        title="Lab results"
        description="A clear place for the results and notes you choose to keep track of."
      />

      <section className="max-w-2xl rounded-3xl border border-[#eadcf4] bg-white p-6 shadow-sm sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-lavender/70 text-brand-purple">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-6">
            <path d="M9 3h6M10 3v5l-4.5 8.5A2.5 2.5 0 0 0 7.7 20h8.6a2.5 2.5 0 0 0 2.2-3.5L14 8V3" />
            <path d="M7.5 15h9" />
          </svg>
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink">No lab results added</h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-ink/65">
          HerBody doesn&apos;t receive results from a clinic. You can keep a filename reminder in your document list.
        </p>
        <Link
          href="/documents"
          className="mt-5 inline-flex min-h-10 items-center rounded-full bg-brand-purple px-5 text-sm font-semibold text-white transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          View documents
        </Link>
      </section>
    </main>
  );
}
