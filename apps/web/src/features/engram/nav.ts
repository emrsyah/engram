import type { Icons } from "./components/icons";

export type NavView = {
  label: string;
  href: string;
  icon: keyof typeof Icons;
};

export const NAV_VIEWS: NavView[] = [
  { label: "Focus", href: "/focus", icon: "target" },
  { label: "Canvas", href: "/canvas", icon: "layout" },
  { label: "Timeline", href: "/timeline", icon: "calendar" },
];

export const SPACE_ICONS = {
  sparkles: "sparkles",
  briefcase: "briefcase",
  book: "book",
  target: "target",
  flag: "flag",
  calendar: "calendar",
  file: "file",
  link: "link",
  image: "image",
  clock: "clock",
  archive: "archive",
  square: "square",
} as const satisfies Record<string, keyof typeof Icons>;

export type SpaceIconKey = keyof typeof SPACE_ICONS;
