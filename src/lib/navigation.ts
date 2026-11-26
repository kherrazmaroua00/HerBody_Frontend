export type NavigationIcon =
  | "home"
  | "body"
  | "checkin"
  | "cycle"
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
};

export const NAVIGATION: NavigationItem[] = [
  {
    label: "Home",
    href: "/",
    icon: "home",
  },
  {
    label: "Interactive Body",
    href: "/interactive-body",
    icon: "body",
    group: "Healthy Life",
  },
  {
    label: "Daily Check-in",
    href: "/daily-check-in",
    icon: "checkin",
    group: "Healthy Life",
  },
  {
    label: "Cycle and Symptoms",
    href: "/cycle-and-symptoms",
    icon: "cycle",
    group: "Healthy Life",
  },
  {
    label: "Documents",
    href: "/documents",
    icon: "documents",
    group: "Health Journey",
  },
  {
    label: "Lab Results",
    href: "/lab-results",
    icon: "labs",
    group: "Health Journey",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: "settings",
  },
];
