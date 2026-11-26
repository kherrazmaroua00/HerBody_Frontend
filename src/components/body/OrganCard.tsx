import { ORGANS } from "@/lib/organs";
import type { OrganId } from "@/types/organ";

type OrganCardProps = {
  selectedOrgan: OrganId | null;
  compact?: boolean;
};

export default function OrganCard({
  selectedOrgan,
  compact = false,
}: OrganCardProps) {
  const organ = selectedOrgan ? ORGANS[selectedOrgan] : null;

  return (
    <article
      className={`rounded-2xl border border-brand-purple/10 ${
        compact
          ? "bg-white/95 p-4 shadow-xl backdrop-blur"
          : "bg-white p-5 shadow-sm sm:p-6"
      }`}
    >
      {organ ? (
        <>
          <span className={`inline-flex rounded-full bg-lavender px-3 py-1 font-semibold text-brand-purple ${compact ? "text-[10px]" : "text-xs"}`}>
            Selected organ
          </span>
          <h2 className={`font-bold text-brand-purple ${compact ? "mt-2 text-xl" : "mt-4 text-2xl"}`}>{organ.label}</h2>
          <p className={`text-ink/75 ${compact ? "mt-1 text-xs leading-5" : "mt-2 text-sm leading-6"}`}>{organ.role}</p>
          <ul className={`text-ink/80 ${compact ? "mt-2 space-y-1 text-xs leading-4" : "mt-4 space-y-2 text-sm leading-6"}`}>
            {(compact ? organ.facts.slice(0, 1) : organ.facts).map((fact) => (
              <li key={fact} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-pink" />
                <span>{fact}</span>
              </li>
            ))}
          </ul>
          {!compact && (
            <p className="mt-5 border-t border-brand-purple/10 pt-4 text-xs leading-5 text-ink/65">
              Educational information only. HerBody explains and guides; it does not diagnose.
            </p>
          )}
        </>
      ) : (
        <div className="min-h-32">
          <span className="inline-flex rounded-full bg-lavender px-3 py-1 text-xs font-semibold text-brand-purple">
            Organ guide
          </span>
          <h2 className="mt-4 text-xl font-semibold text-brand-purple">Explore an organ</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Tap an organ to learn about it.
          </p>
        </div>
      )}
    </article>
  );
}
