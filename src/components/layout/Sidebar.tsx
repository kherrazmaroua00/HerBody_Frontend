"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { NavigationIconView } from "@/components/icons/NavigationIcons";
import { clearAccessToken } from "@/lib/api/auth";
import { NAVIGATION, type NavigationItem } from "@/lib/navigation";
import { SIDEBAR_COLLAPSED_KEY } from "@/lib/preferences";

const SIDEBAR_PREF_KEY = SIDEBAR_COLLAPSED_KEY;

function subscribeToPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("herbody-sidebar-preference", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("herbody-sidebar-preference", callback);
  };
}

function getCollapsedPreference() {
  try {
    return localStorage.getItem(SIDEBAR_PREF_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerCollapsedPreference() {
  return false;
}

function subscribeToProfile(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("herbody-profile-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("herbody-profile-updated", callback);
  };
}

function getProfileName() {
  const name = sessionStorage.getItem("herbody_user_name");
  if (name) return name;
  const email = sessionStorage.getItem("herbody_user_email");
  return email ? email.split("@")[0] : "My Profile";
}

function getServerProfileName() {
  return "My Profile";
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/daily-check-in")) return "Daily Check-in";
  if (pathname.startsWith("/cycle-and-symptoms")) return "Cycle and Symptoms";
  if (pathname.startsWith("/documents")) return "Documents";
  if (pathname.startsWith("/lab-results")) return "Lab Results";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/interactive-body")) return "Interactive Body";
  if (pathname.startsWith("/healthy-life")) return "Healthy Life";
  if (pathname.startsWith("/health-journey")) return "Home";
  return "HerBody";
}

function SidebarTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  const id = `sidebar-tooltip-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <span className="relative block">
      <span className="block">
        {children}
      </span>
      {collapsed && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {label}
        </span>
      )}
    </span>
  );
}

function SidebarItem({
  item,
  collapsed,
  drawer = false,
  onNavigate,
}: {
  item: NavigationItem;
  collapsed: boolean;
  drawer?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const tooltipId = `sidebar-tooltip-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const active = pathname === item.href;

  const content = (
    <>
      <NavigationIconView name={item.icon} className="size-[18px] shrink-0" />
      <span
        aria-hidden={collapsed && !drawer}
        className={`whitespace-nowrap text-[11px] font-medium transition-opacity duration-160 ${
          collapsed && !drawer ? "pointer-events-none w-0 opacity-0" : "opacity-100"
        }`}
      >
        {item.label}
      </span>
    </>
  );

  return (
    <li className="group">
      <SidebarTooltip collapsed={collapsed && !drawer} label={item.label}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          aria-describedby={collapsed && !drawer ? tooltipId : undefined}
          aria-label={collapsed && !drawer ? item.label : undefined}
          onClick={onNavigate}
          className={`flex h-[30px] w-full items-center gap-2.5 rounded-[10px] px-2.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple ${
            active
              ? "bg-lavender text-brand-purple"
              : "text-ink/80 hover:bg-blush hover:text-brand-purple"
          }`}
        >
          {content}
        </Link>
      </SidebarTooltip>
    </li>
  );
}

function SidebarProfile({
  collapsed,
  drawer = false,
}: {
  collapsed: boolean;
  drawer?: boolean;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const profileName = useSyncExternalStore(
    subscribeToProfile,
    getProfileName,
    getServerProfileName,
  );

  async function logout() {
    setLoggingOut(true);
    clearAccessToken();
    sessionStorage.removeItem("herbody_user_name");
    sessionStorage.removeItem("herbody_user_email");
    window.dispatchEvent(new Event("herbody-profile-updated"));
    router.push("/login");
  }

  return (
    <div className="mt-auto border-t border-sidebar-border px-2.5 py-2.5">
      <div className={`flex items-center ${collapsed && !drawer ? "justify-center" : "gap-3"}`}>
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lavender text-[10px] font-bold text-brand-purple">
          {profileName.charAt(0).toUpperCase()}
        </span>
        {(!collapsed || drawer) && (
          <span className="min-w-0">
            <strong className="block truncate text-[11px] leading-4 text-ink">{profileName}</strong>
            <small className="block text-[9px] leading-3 text-ink/55">Member</small>
          </span>
        )}
        {(!collapsed || drawer) && (
          <button
            type="button"
            aria-label="Log out"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="ml-auto grid size-7 place-items-center rounded-full text-ink/60 transition hover:bg-blush hover:text-brand-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <NavigationIconView name="logout" className="size-[18px]" />
          </button>
        )}
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  drawer = false,
  onNavigate,
  onClose,
}: {
  collapsed: boolean;
  drawer?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Healthy Life": true,
    "Health Journey": true,
  });
  const groups = ["Healthy Life", "Health Journey"] as const;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className={`flex h-14 items-center ${collapsed && !drawer ? "justify-center px-2" : "justify-between px-2.5"}`}>
        <Link
          href="/health-journey"
          aria-label="HerBody home"
          className="flex items-center gap-2"
        >
          <Image
            src="/herbody_logo.png"
            alt=""
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-full object-cover"
          />
          {(!collapsed || drawer) && (
            <span className="whitespace-nowrap text-[15px] font-bold tracking-tight text-brand-purple">HerBody</span>
          )}
        </Link>
        {(!collapsed || drawer) && !drawer && (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-label="Collapse sidebar"
            onClick={onClose}
            className="grid size-6 place-items-center rounded-full text-sm text-brand-purple hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>
        )}
        {collapsed && !drawer && (
          <button
            type="button"
            aria-expanded={false}
            aria-label="Expand sidebar"
            onClick={onClose}
            className="absolute left-1/2 top-[42px] grid size-7 -translate-x-1/2 place-items-center rounded-full border border-brand-purple/10 bg-white text-brand-purple shadow-sm hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
              <path d="m10 6 6 6-6 6" />
            </svg>
          </button>
        )}
        {drawer && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-brand-purple hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-1.5">
        <ul>
          {NAVIGATION.filter((item) => !item.group).filter((item) => item.label === "Home").map((item) => (
            <SidebarItem key={item.label} item={item} collapsed={collapsed} drawer={drawer} onNavigate={onNavigate} />
          ))}
        </ul>

        {groups.map((group) => {
          const items = NAVIGATION.filter((item) => item.group === group);
          const open = openGroups[group];
          return (
            <section key={group} className={collapsed && !drawer ? "mt-2 border-t border-sidebar-border pt-2" : "mt-3"}>
              {collapsed && !drawer ? null : (
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenGroups((current) => ({ ...current, [group]: !current[group] }))}
                  className="flex h-7 w-full items-center justify-between px-1.5 text-left text-[9px] font-bold uppercase tracking-[0.08em] text-sidebar-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                >
                  <span className="whitespace-nowrap">{group}</span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`size-3 transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
              )}
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-160 ${
                  open || (collapsed && !drawer) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <ul className="min-h-0 overflow-hidden">
                  {items.map((item) => (
                    <SidebarItem
                      key={item.label}
                      item={item}
                      collapsed={collapsed}
                      drawer={drawer}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </div>
            </section>
          );
        })}

        <ul className="mt-auto pt-2">
          {NAVIGATION.filter((item) => item.label === "Settings").map((item) => (
            <SidebarItem key={item.label} item={item} collapsed={collapsed} drawer={drawer} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
      <SidebarProfile collapsed={collapsed} drawer={drawer} />
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeToPreference,
    getCollapsedPreference,
    getServerCollapsedPreference,
  );
  const profileName = useSyncExternalStore(
    subscribeToProfile,
    getProfileName,
    getServerProfileName,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const shouldReturnFocus = useRef(false);

  useEffect(() => {
    try {
      getCollapsedPreference();
    } catch {
      // localStorage can be unavailable in privacy modes.
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen) {
      shouldReturnFocus.current = true;
    } else if (shouldReturnFocus.current) {
      shouldReturnFocus.current = false;
      menuButtonRef.current?.focus();
    }
  }, [drawerOpen]);

  function toggleCollapsed() {
    const next = !collapsed;
    try {
      localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
    } catch {
      // Keep the in-memory preference for this session.
    }
    window.dispatchEvent(new Event("herbody-sidebar-preference"));
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <>
      <aside
        aria-label="Primary sidebar"
        className={`sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-brand-purple/10 bg-white transition-[width] duration-280 ease-[cubic-bezier(0.22,0.8,0.3,1)] motion-reduce:transition-none lg:block ${
          collapsed ? "w-[72px]" : "w-[180px]"
        }`}
      >
        <SidebarContent
          collapsed={collapsed}
          onClose={toggleCollapsed}
        />
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-brand-purple/10 bg-white/95 px-4 lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="grid size-10 shrink-0 place-items-center rounded-full text-brand-purple hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="size-5">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-bold text-brand-purple">
          {getPageTitle(pathname)}
        </p>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lavender text-xs font-bold text-brand-purple">
          {profileName.charAt(0).toUpperCase()}
        </span>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/30"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="sidebar-drawer absolute inset-y-0 left-0 w-[300px] max-w-[calc(100vw-60px)] overflow-hidden shadow-xl"
          >
            <SidebarContent
              collapsed={false}
              drawer
              onNavigate={closeDrawer}
              onClose={closeDrawer}
            />
          </aside>
        </div>
      )}
    </>
  );
}
