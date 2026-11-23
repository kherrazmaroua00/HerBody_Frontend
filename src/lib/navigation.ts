export type NavigationIcon =
  | "home"
  | "body"
  | "checkin"
  | "cycle"
  | "dashboard"
  | "documents"
  | "labs"
  | "settings"
  | "logout";

export type NavigationGroup = "Healthy Life" | "Health Journey";

export type NavigationItem = {
  label: string;
  href: string;
  icon: NavigationIcon;
  group?: NavigationGroup;
  comingSoon: boolean;
};

export const NAVIGATION: NavigationItem[] = [
  {
    label: "Home",
    href: "/health-journey",
    icon: "home",
    comingSoon: false,
  },
  {
    label: "Interactive Body",
    href: "/interactive-body",
    icon: "body",
    group: "Healthy Life",
    comingSoon: false,
  },
  {
    label: "Daily Check-in",
    href: "/daily-check-in",
    icon: "checkin",
    group: "Healthy Life",
    comingSoon: true,
  },
  {
    label: "Cycle and Symptoms",
    href: "/cycle-and-symptoms",
    icon: "cycle",
    group: "Healthy Life",
    comingSoon: true,
  },
  {
    label: "Dashboard",
    href: "/health-journey",
    icon: "dashboard",
    group: "Health Journey",
    comingSoon: false,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: "documents",
    group: "Health Journey",
    comingSoon: true,
  },
  {
    label: "Lab Results",
    href: "/lab-results",
    icon: "labs",
    group: "Health Journey",
    comingSoon: true,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "settings",
    comingSoon: true,
  },
];
