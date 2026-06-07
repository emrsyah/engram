import { AppSidebar } from "@/features/engram/components/app-sidebar";

import { Hotkeys } from "@/features/engram/components/hotkeys";
import { ItemDetailPanel } from "@/features/engram/components/item-detail-panel";
import { NoteEditorPanel } from "@/features/engram/components/note-editor-panel";
import { QuickCaptureBar } from "@/features/engram/components/quick-capture-bar";
import { SearchDialog } from "@/features/engram/components/search-dialog";
import { ShortcutsDialog } from "@/features/engram/components/shortcuts-dialog";
import { TopBar } from "@/features/engram/components/top-bar";
import { EngramProvider } from "@/features/engram/store";
import { UIProvider } from "@/features/engram/ui-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EngramProvider>
      <UIProvider>
        <Hotkeys />
        <div className="engram-shell">
          <AppSidebar />
          <main className="engram-main">
            <TopBar />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            <SearchDialog />
            <ShortcutsDialog />
            <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
              <div className="pointer-events-auto">
                <QuickCaptureBar />
              </div>
            </div>
            <ItemDetailPanel />
            <NoteEditorPanel />
          </main>
        </div>
      </UIProvider>
    </EngramProvider>
  );
}
