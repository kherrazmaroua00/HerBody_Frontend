import { Suspense } from "react";
import InteractiveBodyClient from "@/app/interactive-body/InteractiveBodyClient";
import { ORGANS } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

type PageProps = {
  searchParams: Promise<{ organ?: string | string[] }>;
};

function isOrganId(value: string | undefined): value is OrganId {
  return value !== undefined && Object.prototype.hasOwnProperty.call(ORGANS, value);
}

async function InteractiveBodyContent({ searchParams }: PageProps) {
  const { organ } = await searchParams;
  const requestedOrgan = Array.isArray(organ) ? organ[0] : organ;
  const initialOrgan = isOrganId(requestedOrgan) ? requestedOrgan : null;

  return <InteractiveBodyClient initialOrgan={initialOrgan} />;
}

export default function InteractiveBodyPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center px-6 text-sm text-brand-purple/70">
          Loading your body explorer…
        </main>
      }
    >
      <InteractiveBodyContent {...props} />
    </Suspense>
  );
}
