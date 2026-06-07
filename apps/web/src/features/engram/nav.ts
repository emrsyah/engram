import type { Icons } from "./components/icons";

export type NavView = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
};

export const NAV_VIEWS: NavView[] = [
  { label: "Canvas", href: "/canvas", icon: "layout" },
  { label: "Timeline", href: "/timeline", icon: "calendar" },
  { label: "Priorities", href: "/priorities", icon: "flag" },
];

export const SPACE_ICONS = {
  sparkles: "sparkles",
  briefcase: "briefcase",
  book: "book",
} as const satisfies Record<string, keyof typeof Icons>;

export type SpaceIconKey = keyof typeof SPACE_ICONS;
