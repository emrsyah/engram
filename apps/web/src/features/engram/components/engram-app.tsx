"use client";

import { AppSidebar } from "./app-sidebar";
import { CanvasView } from "./canvas-view";
import { CaptureDialog } from "./capture-dialog";
import { PrioritiesView } from "./priorities-view";
import { SearchDialog } from "./search-dialog";
import { TimelineView } from "./timeline-view";
import { TopBar } from "./top-bar";
import { EngramProvider, useEngramStore } from "../store";

export function EngramApp() {
  return (
    <EngramProvider>
      <EngramContent />
    </EngramProvider>
  );
}

function EngramContent() {
  const { activeView } = useEngramStore();

  return (
    <div className="engram-shell">
      <AppSidebar />
      <main className="engram-main">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeView === "canvas" ? <CanvasView /> : null}
          {activeView === "timeline" ? <TimelineView /> : null}
          {activeView === "priorities" ? <PrioritiesView /> : null}
        </div>
        <CaptureDialog />
        <SearchDialog />
      </main>
    </div>
  );
}
