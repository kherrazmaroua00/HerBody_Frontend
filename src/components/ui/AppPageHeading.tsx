import { NavigationIconView } from "@/components/icons/NavigationIcons";
import type { NavigationIcon } from "@/lib/navigation";

export default function AppPageHeading({
  icon,
  eyebrow,
  title,
  description,
}: {
  icon: NavigationIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-pink">
        {eyebrow}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-lavender/70 text-brand-purple">
          <NavigationIconView name={icon} className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-purple sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-ink/65">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
