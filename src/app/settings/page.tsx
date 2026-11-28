"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import AppPageHeading from "@/components/ui/AppPageHeading";
import { clearAccessToken } from "@/lib/api/auth";
import {
  resetPreferences,
  setReduceMotion,
  setSidebarCollapsed,
  setWeekStartsOn,
  useReduceMotion,
  useSidebarCollapsed,
  useWeekStartsOn,
} from "@/lib/preferences";

/* ---------------- Profile (kept in this browser session, as before) ---------------- */

function subscribeToProfile(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("herbody-profile-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("herbody-profile-updated", callback);
  };
}

const getStoredName = () => sessionStorage.getItem("herbody_user_name") || "";
const getStoredEmail = () => sessionStorage.getItem("herbody_user_email") || "";
const getServerValue = () => "";

/* ---------------- Building blocks ---------------- */

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "display", label: "Display" },
  { id: "calendar", label: "Calendar" },
  { id: "privacy", label: "Privacy & data" },
  { id: "about", label: "About" },
] as const;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple";

function Card({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6 rounded-3xl border border-[#eadcf4] bg-white p-5 shadow-sm sm:p-6">
      <h2 id={`${id}-title`} className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-ink/60">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#f1e6f8] py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-ink/55">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${focusRing} ${checked ? "bg-brand-purple" : "bg-[#e4d6ee]"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-full border border-[#eadcf4] bg-white p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`min-h-8 rounded-full px-3.5 text-xs font-semibold transition ${focusRing} ${
              active ? "bg-brand-purple text-white shadow-sm" : "text-ink/65 hover:bg-lavender/40"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const secondaryButton = `min-h-9 shrink-0 rounded-full border border-brand-purple/25 px-4 text-xs font-semibold text-brand-purple transition hover:bg-lavender/30 ${focusRing}`;

/* ---------------- Page ---------------- */

export default function SettingsPage() {
  const router = useRouter();
  const storedName = useSyncExternalStore(subscribeToProfile, getStoredName, getServerValue);
  const email = useSyncExternalStore(subscribeToProfile, getStoredEmail, getServerValue);
  const [editedName, setEditedName] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const name = editedName ?? storedName;

  const sidebarCollapsed = useSidebarCollapsed();
  const reduceMotion = useReduceMotion();
  const weekStartsOn = useWeekStartsOn();

  const [confirmReset, setConfirmReset] = useState(false);
  const [dataMessage, setDataMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const displayName = name.trim() || (email ? email.split("@")[0] : "");

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    sessionStorage.setItem("herbody_user_name", trimmed);
    setEditedName(trimmed);
    window.dispatchEvent(new Event("herbody-profile-updated"));
    setProfileMessage("Your display name has been saved.");
  }

  function signOut() {
    setSigningOut(true);
    clearAccessToken();
    sessionStorage.removeItem("herbody_user_name");
    sessionStorage.removeItem("herbody_user_email");
    window.dispatchEvent(new Event("herbody-profile-updated"));
    router.push("/login");
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="settings"
        eyebrow="Your preferences"
        title="Settings"
        description="Manage your profile and how HerBody looks and behaves on this device."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-6">
          <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className={`block rounded-full px-3.5 py-2 text-sm font-medium text-ink/70 transition hover:bg-white hover:text-brand-purple lg:rounded-xl ${focusRing}`}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-5">
          <Card id="profile" title="Profile" description="How you appear in HerBody. Your display name is kept for this browser session.">
            <form onSubmit={saveProfile}>
              <div className="flex items-center gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-lavender text-xl font-bold text-brand-purple" aria-hidden="true">
                  {(displayName || "?").charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">{displayName || "Your profile"}</p>
                  <p className="truncate text-xs text-ink/55">{email || "Email not available in this session"}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink/80">
                  Display name
                  <input
                    value={name}
                    onChange={(event) => {
                      setEditedName(event.target.value);
                      setProfileMessage("");
                    }}
                    maxLength={60}
                    placeholder="How should we call you?"
                    className="mt-2 h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-sm font-normal text-ink outline-none placeholder:text-ink/40 focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
                  />
                </label>
                <label className="block text-xs font-semibold text-ink/80">
                  Email
                  <input
                    value={email}
                    readOnly
                    placeholder="—"
                    className="mt-2 h-11 w-full rounded-xl border border-[#eadcf4] bg-blush/50 px-3 text-sm font-normal text-ink/65 outline-none"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={!name.trim() || name.trim() === storedName}
                  className={`min-h-10 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white transition hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                >
                  Save profile
                </button>
                <p className="text-sm text-brand-purple" role="status" aria-live="polite">{profileMessage}</p>
              </div>
            </form>
          </Card>

          <Card id="display" title="Display" description="Saved on this device and applied right away.">
            <Row title="Compact sidebar" description="Show only icons in the sidebar on large screens.">
              <Toggle label="Compact sidebar" checked={sidebarCollapsed} onChange={setSidebarCollapsed} />
            </Row>
            <Row title="Reduce animations" description="Stop pulsing markers in the 3D body and shorten transitions everywhere.">
              <Toggle label="Reduce animations" checked={reduceMotion} onChange={setReduceMotion} />
            </Row>
          </Card>

          <Card id="calendar" title="Calendar" description="How the cycle calendar is laid out.">
            <Row title="Week starts on" description="First day of the week in the Cycle and Symptoms calendar.">
              <Segmented
                label="Week starts on"
                value={weekStartsOn}
                options={[{ value: 0, label: "Sunday" }, { value: 1, label: "Monday" }]}
                onChange={setWeekStartsOn}
              />
            </Row>
          </Card>

          <Card id="privacy" title="Privacy & data" description="Your health records are only shown to you after you sign in.">
            <Row
              title="Reset preferences"
              description="Restore the default display and calendar settings on this device. Your health records are not affected."
            >
              {confirmReset ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetPreferences();
                      setConfirmReset(false);
                      setDataMessage("Preferences reset to their defaults.");
                    }}
                    className={`min-h-9 rounded-full bg-brand-purple px-4 text-xs font-semibold text-white ${focusRing}`}
                  >
                    Yes, reset
                  </button>
                  <button type="button" onClick={() => setConfirmReset(false)} className={secondaryButton}>Cancel</button>
                </div>
              ) : (
                <button type="button" onClick={() => { setConfirmReset(true); setDataMessage(""); }} className={secondaryButton}>
                  Reset
                </button>
              )}
            </Row>
            <Row title="Sign out" description="Sign out of HerBody on this device.">
              <button type="button" disabled={signingOut} onClick={signOut} className={`${secondaryButton} disabled:opacity-50`}>
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </Row>
            <p className="mt-3 min-h-5 text-sm text-brand-purple" role="status" aria-live="polite">{dataMessage}</p>
          </Card>

          <Card id="about" title="About HerBody" description="A calm companion for learning about and tracking your health.">
            <ul className="grid gap-2 text-sm leading-6 text-ink/70">
              <li>HerBody shows information to help you notice patterns. It is not a diagnosis and does not replace a health professional.</li>
              <li>Cycle predictions, fertile window and ovulation dates are estimates and must not be used as contraception.</li>
              <li>Lab statuses, reference ranges and critical flags come from your own lab reports.</li>
            </ul>
          </Card>
        </div>
      </div>
    </main>
  );
}
