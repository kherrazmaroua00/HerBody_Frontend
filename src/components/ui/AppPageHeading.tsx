import { NavigationIconView } from "@/components/icons/NavigationIcons";
import type { NavigationIcon } from "@/lib/navigation";

export default function AppPageHeading({
  icon,
  eyebrow,
  title,
  description,
  compact = false,
}: {
  icon: NavigationIcon;
  eyebrow: string;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <header className={compact ? "mb-3" : "mb-6"}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-pink">
        {eyebrow}
      </p>
      <div className={`flex items-center ${compact ? "mt-1 gap-2" : "mt-2 gap-3"}`}>
        <span className={`grid shrink-0 place-items-center bg-lavender/70 text-brand-purple ${
          compact ? "size-9 rounded-xl" : "size-11 rounded-2xl"
        }`}>
          <NavigationIconView name={icon} className="size-5" />
        </span>
        <div>
          <h1 className={`font-bold tracking-tight text-brand-purple ${
            compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
          }`}>
            {title}
          </h1>
          <p className={`text-ink/65 ${
            compact ? "mt-0.5 text-xs leading-4" : "mt-1 max-w-2xl text-sm leading-5"
          }`}>
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
