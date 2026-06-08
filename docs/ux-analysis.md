# Engram UX & Mental Model Analysis

## Does the current mental model support the core needs?

**Partially.** The app has strong bones, but there's a gap between what it's optimized for (spatial canvas exploration) and what is actually needed most of the time (fast capture + daily focus).

---

## Need-by-Need Breakdown

### 1. Easy todo capture (now/later/specific date, across contexts)

**What works:** Quick capture is excellent. Natural language parsing (`tomorrow 3pm`, `!p1`), task chaining, priority/date pickers, "Keep open" for rapid-fire entry. This is the strongest part of the app.

**What's missing or weak:**

- **No "later" / "someday" as a first-class capture option.** You have to leave the due date blank, which creates an implicit "someday" — but there's no affordance for it in capture. You can't type `someday` or `later` in the capture bar. The Timeline view has a "Someday" bucket but you can't *target* it from capture.
- **No way to assign a Space from capture.** All items go to the active space. If you're on the "Mind" canvas and want to quickly add a task for "Work" or "School", you have to: switch space → capture, or capture → then move it. That friction kills the "write it down immediately" flow.
- **No tags or labels.** Spaces are the only grouping mechanism. But school/work/freelance/side-project aren't really separate canvases — they're overlapping contexts. A task can belong to both "school" and "freelance". Spaces force you to pick one.
- **Recurring tasks don't exist.** If you have "Submit weekly report every Friday", you'd have to recreate it each week.

---

### 2. Quick thought capture + find it later

**What works:** The Thought mode with Shift+Enter for notes, auto-morphing to notes mode, pop-out editor. The search dialog (Cmd+K style) searches across title/text/url/caption/source.

**What's missing or weak:**

- **No tagging or categorization for thoughts.** They float on the canvas with no way to group them beyond spatial proximity. After 100 thoughts, the canvas becomes a mess and search becomes your only retrieval method — but search requires you to remember the right keyword.
- **No "recent thoughts" view.** The sidebar shows "Recent items" (5 max), but that's all types mixed together. There's no way to browse just your thoughts chronologically.
- **Canvas as the primary mental model for thoughts is questionable.** Spatial positioning works for *organizing* ideas you're actively working with. But for *retrieval*, you want chronological/tag-based access. The canvas adds friction: after capture, a thought appears at some coordinate and you may never see it again unless you search.

---

### 3. Not brittle like existing todo apps

**This is where Engram genuinely shines.** The architecture is solid:

- Undo delete with toast
- Corrupt-payload backup on localStorage
- Zod validation at the persistence boundary
- Clean separation of core/persistence/store means data integrity is enforced

**But there's one brittleness risk:** localStorage is volatile. One "Clear site data" and everything is gone. The persistence adapter seam is designed for PowerSync, but until that's implemented, the app is *more* brittle than cloud-synced alternatives in terms of data loss. This matters because you don't want brittleness.

---

### 4. Easy bookmark/file saving for later

**What works:** Link mode in capture auto-detects URLs, shows favicon preview. Attach mode with drag-and-drop. Image/file type distinction.

**What's missing or weak:**

- **No actual URL metadata fetching.** The link card just shows the domain name. No title scrape, no description, no Open Graph preview. For a "read later" flow, you need to see *what* the link is about without clicking it.
- **No "read later" status.** Links are just items. You can mark them `done` but "done" for a link means... you read it? That's semantically confusing. A bookmark/link needs states like: unread, reading, archived.
- **Files are not actually stored.** The attach flow creates a card with a file name and a blob URL — but blob URLs don't survive page reload. The file isn't actually persisted. This is essentially a placeholder feature right now.
- **No link collection view.** There's no way to see all your links/bookmarks in one place. They're scattered across spaces on the canvas.

---

### 5. Easy organization

**What works:** Spaces give you separate canvases. Drag-to-reorder in sidebar. Links between items. DnD everywhere (timeline, priorities, focus, checklist).

**What's missing or weak:**

- **Spaces are too rigid.** They're exclusive buckets (an item belongs to one space). Real life has overlapping contexts. Tags would solve so — an item can have `#school` and `#urgent`.
- **No way to move items between spaces.** There's no "Move to space" action in the detail panel. Once an item is in a space, it stays there unless you manually change `spaceId` through the store.
- **Canvas spatial organization doesn't scale.** When you have 50+ items, the canvas becomes unmanageable. There's no grouping, folding, or zoom-to-cluster mechanism.
- **The sidebar "Recent" section only shows 5 items.** That's not enough for re-finding things.

---

### 6. Daily focus / what to do today

**What works:** The Focus view is the most aligned with this need. Top 3 priorities, backlog, pin/unpin, today's unpinned tasks, Pomodoro timer, scratchpad, daily note upsert, progress bar, celebration burst. This is genuinely well-designed.

**What's missing or weak:**

- **Focus only shows pinned + today-due tasks.** It doesn't show overdue tasks. If you had something due yesterday that's not done, it disappears from "Due today" and isn't surfaced anywhere.
- **No "morning review" flow.** You have to manually hunt for what to pin. A good daily focus would surface: overdue + today + unprioritized recent tasks, and let you quickly triage them into the focus list.
- **The Focus view is a separate page, not integrated with the canvas.** You switch to `/focus` and lose your spatial context. There's no way to see your top 3 *while* looking at your canvas.
- **No end-of-day review or rollover.** Incomplete today tasks don't automatically roll to tomorrow. They just become overdue.

---

## What to Cut, Keep, or Add

### Consider cutting or deprioritizing

| Feature | Why |
|---|---|
| **Canvas as default landing** | Primary need is todo + capture + focus. The canvas is the *least* efficient view for those flows. It's beautiful but not the daily driver. Consider making Focus the default route. |
| **Item links (connectors)** | Visually cool, but in practice how often do you link two items? Adds UI complexity (link button, edge click handling) for low daily value. |
| **Image card type** | Files aren't actually persisted. Image cards are placeholders. Cut until real file storage exists. |
| **Priorities as a separate page** | It's a projection that's redundant with Focus. Focus already groups by priority (top 3 = P1 by convention). The 3-column drag view is neat but solves a problem Focus already handles. |

### Consider adding

| Feature | Why |
|---|---|
| **Tags/Labels on items** | This is the #1 gap. Tags give you overlapping contexts (school + urgent), searchable categories, and a retrieval mechanism that works at scale. Spaces alone can't do this. |
| **Overdue task surfacing** | Critical for daily focus. Without it, tasks silently fall through the cracks — exactly the brittleness to avoid. |
| **"Move to space" action** | Basic organization that's currently missing. |
| **Space selector in capture bar** | A small dropdown to pick target space from capture. Eliminates the switch-then-capture friction. |
| **Someday/Later as capture keyword** | `later`, `someday`, `next week` should parse into a no-due-date state with a visual chip. |
| **Read-later status for links** | Unread → Reading → Archived states instead of done/undone. |
| **Morning triage in Focus** | When Focus opens, surface: overdue + today + recent unprioritized. One-click pin/snooze/dismiss. |
| **Auto-rollover for overdue** | Or at minimum, a "Reschedule" button on overdue tasks. |

---

## The Core Problem: Mental Model Mismatch

The current model is **Canvas-first**: everything lives on the canvas, other views are projections. But the real needs are **Capture-first, Focus-first**: write things down fast, see what matters today, and organize when you have time. The canvas is great for the *organize* part but adds friction for the *capture* and *focus* parts because it demands spatial thinking when you just want to dump a thought and move on.

### Recommended mental model shift: "Inbox with Views"

1. **Quick capture is the inbox** — everything enters here
2. **Focus is the daily operating view** — what you see first
3. **Canvas is the thinking/organizing space** — where you go when you want to spatially arrange things
4. **Timeline/Priorities remain projections** — for when you need them

This doesn't require removing the canvas — it requires changing which view is the default and making capture flow into any view without requiring the canvas as intermediary.
