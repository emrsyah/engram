"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alphonse/ui/components/dialog";

import { useUIStore } from "../ui-store";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const SECTIONS: { title: string; shortcuts: { keys: string[]; label: string }[] }[] = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["1"], label: "Go to Focus" },
      { keys: ["2"], label: "Go to Canvas" },
      { keys: ["3"], label: "Go to Timeline" },
      { keys: ["4"], label: "Go to Priorities" },
      { keys: ["["], label: "Toggle sidebar" },
    ],
  },
  {
    title: "Spaces",
    shortcuts: [
      { keys: [mod, "1"], label: "Switch to Space 1" },
      { keys: [mod, "2"], label: "Switch to Space 2" },
      { keys: [mod, "3"], label: "Switch to Space 3" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["N"], label: "Capture thought / task" },
      { keys: [mod, "T"], label: "Capture a task" },
      { keys: [mod, "K"], label: "Search items" },
      { keys: ["/"], label: "Search items" },
      { keys: ["?"], label: "Show shortcuts" },
    ],
  },
  {
    title: "Canvas",
    shortcuts: [
      { keys: ["F"], label: "Toggle focus pin on selected task" },
      { keys: ["Dbl-click"], label: "Create thought at cursor" },
      { keys: ["Drag"], label: "Pan canvas" },
      { keys: ["Scroll"], label: "Zoom in / out" },
      { keys: ["Esc"], label: "Cancel link mode" },
    ],
  },
];

export function ShortcutsDialog() {
  const { shortcutsOpen, closeShortcuts } = useUIStore();

  return (
    <Dialog open={shortcutsOpen} onOpenChange={(open) => !open && closeShortcuts()}>
      <DialogContent className="bg-[#18161380] backdrop-blur-xl border-[#302c27] sm:max-w-[540px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#2a2621]">
          <DialogTitle className="text-white font-bold text-base">Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.12em]">
                {section.title}
              </p>
              <div className="space-y-2">
                {section.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-4">
                    <span className="text-[#b0a99f] text-sm">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="min-w-[22px] rounded-[4px] border border-[#3a3530] bg-[#252220] px-1.5 py-0.5 text-center font-mono text-[11px] text-[#9a9088]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-[#2a2621] border-t px-6 py-3">
          <p className="text-[#5a5450] text-xs">Press <kbd className="font-mono">Esc</kbd> or <kbd className="font-mono">?</kbd> to close</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
