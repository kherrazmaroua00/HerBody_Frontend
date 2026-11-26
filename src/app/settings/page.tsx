"use client";

import { useState, useSyncExternalStore } from "react";
import AppPageHeading from "@/components/ui/AppPageHeading";

function subscribeToProfile(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("herbody-profile-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("herbody-profile-updated", callback);
  };
}

function getStoredName() {
  return sessionStorage.getItem("herbody_user_name") || "";
}

function getStoredEmail() {
  return sessionStorage.getItem("herbody_user_email") || "";
}

function getServerValue() {
  return "";
}

export default function SettingsPage() {
  const storedName = useSyncExternalStore(
    subscribeToProfile,
    getStoredName,
    getServerValue,
  );
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? storedName;
  const email = useSyncExternalStore(
    subscribeToProfile,
    getStoredEmail,
    getServerValue,
  );
  const [saved, setSaved] = useState(false);

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sessionStorage.setItem("herbody_user_name", name.trim());
    setEditedName(name.trim());
    window.dispatchEvent(new Event("herbody-profile-updated"));
    setSaved(true);
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <AppPageHeading
        icon="settings"
        eyebrow="Your preferences"
        title="Settings"
        description="Review the profile details saved for this browser session."
      />

      <form
        onSubmit={saveProfile}
        className="max-w-2xl rounded-3xl border border-[#eadcf4] bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 className="text-lg font-bold text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ink/65">
          Your profile information is kept in session storage on this device.
        </p>

        <label className="mt-5 block text-xs font-semibold text-ink/80">
          Display name
          <input
            value={name}
            onChange={(event) => {
              setEditedName(event.target.value);
              setSaved(false);
            }}
            maxLength={60}
            className="mt-2 h-11 w-full rounded-xl border border-[#eadcf4] bg-white px-3 text-sm font-normal text-ink outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/15"
          />
        </label>

        <label className="mt-4 block text-xs font-semibold text-ink/80">
          Email
          <input
            value={email}
            readOnly
            className="mt-2 h-11 w-full rounded-xl border border-[#eadcf4] bg-blush/50 px-3 text-sm font-normal text-ink/65 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={!name.trim()}
          className="mt-6 min-h-10 rounded-full bg-brand-purple px-5 text-sm font-semibold text-white transition hover:bg-brand-purple/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save profile
        </button>
        <p className="mt-3 min-h-5 text-sm text-brand-purple" role="status" aria-live="polite">
          {saved ? "Your display name has been saved for this session." : ""}
        </p>
      </form>
    </main>
  );
}
