"use client";

import { useUIStore } from "../ui-store";
import { QuickCaptureBar } from "./quick-capture-bar";

export function QuickCaptureContainer() {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-0 z-50 flex justify-center px-4 transition-[left] duration-200"
      style={{ left: sidebarCollapsed ? 0 : 252 }}
    >
      <div className="pointer-events-auto">
        <QuickCaptureBar />
      </div>
    </div>
  );
}
