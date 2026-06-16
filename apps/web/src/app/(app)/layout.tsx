import { AuthGuard } from "@/components/auth-guard";
import { AppSidebar } from "@/features/engram/components/app-sidebar";
import { BlitzContainer } from "@/features/engram/components/blitz-container";

import { Hotkeys } from "@/features/engram/components/hotkeys";
import { ItemDetailPanel } from "@/features/engram/components/item-detail-panel";
import { NoteEditorPanel } from "@/features/engram/components/note-editor-panel";
import { NewSpaceDialog } from "@/features/engram/components/new-space-dialog";
import { EditSpaceDialog } from "@/features/engram/components/edit-space-dialog";
import { DeleteSpaceDialog } from "@/features/engram/components/delete-space-dialog";
import { QuickCaptureContainer } from "@/features/engram/components/quick-capture-container";
import { SearchDialog } from "@/features/engram/components/search-dialog";
import { ShortcutsDialog } from "@/features/engram/components/shortcuts-dialog";
import { TopBar } from "@/features/engram/components/top-bar";
import { EngramProvider } from "@/features/engram/store";
import { UIProvider } from "@/features/engram/ui-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
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
              <QuickCaptureContainer />
              <ItemDetailPanel />
              <NoteEditorPanel />
              <NewSpaceDialog />
              <EditSpaceDialog />
              <DeleteSpaceDialog />
              <BlitzContainer />
            </main>
          </div>
        </UIProvider>
      </EngramProvider>
    </AuthGuard>
  );
}
