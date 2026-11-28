"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useReduceMotion } from "@/lib/preferences";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();

  // "Reduce animations" from Settings applies to every page.
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [reduceMotion]);
  if (PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh w-full max-w-full overflow-x-clip bg-blush">
      <Sidebar />
      <div className="min-w-0 flex-1 pt-14 lg:pt-0">{children}</div>
    </div>
  );
}
