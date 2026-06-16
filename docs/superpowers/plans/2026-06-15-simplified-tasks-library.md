# Simplified Tasks Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Engram's Focus/Inbox/Board mental model with two main areas: Tasks and Library, while keeping easy grouping and filtering.

**Architecture:** Add explicit task queue fields to items and pure projections for grouped task/library views. Reuse existing spaces as "groups" instead of board destinations, and keep tags as cross-cutting filters. Update navigation/routes and replace the Tasks page with a queue-first interface plus a new Library page.

**Tech Stack:** Next.js App Router, React, TypeScript, local Engram store, Bun tests.

---

## Chunk 1: Domain Model And Projections

### Task 1: Add queue and library projections

**Files:**
- Modify: `apps/web/src/features/engram/types.ts`
- Modify: `apps/web/src/features/engram/engram-core.ts`
- Modify: `apps/web/src/features/engram/projections.ts`
- Test: `apps/web/src/features/engram/engram-core.test.ts`

- [ ] Add `TaskQueue = "now" | "next" | "later" | "waiting"` and optional `taskQueue`, `taskSortOrder` to `Item`.
- [ ] Extend `CreateItemInput` and `buildItem` so new tasks default to `next` with a sort order.
- [ ] Add pure helpers for `allTasks`, `tasksByQueue`, `tasksByTag`, `libraryItems`, `libraryByType`, `libraryByGroup`, and `libraryByTag`.
- [ ] Add `setTaskQueue` mutation that can also update ordering metadata.
- [ ] Add tests for default queue assignment and task/library grouping.

## Chunk 2: Navigation And Routing

### Task 2: Collapse primary nav

**Files:**
- Modify: `apps/web/src/features/engram/nav.ts`
- Modify: `apps/web/src/features/engram/components/app-sidebar.tsx`
- Modify: `apps/web/src/features/engram/components/top-bar.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/(app)/library/page.tsx`
- Modify: legacy route files under `apps/web/src/app/(app)`

- [ ] Keep only `Tasks` and `Library` in primary navigation.
- [ ] Redirect `/`, `/focus`, `/inbox`, `/canvas`, `/timeline`, and `/capture` to `/tasks` or `/library`.
- [ ] Remove board/space controls from the primary sidebar; spaces continue to exist as groups exposed inside Tasks/Library.

## Chunk 3: Views

### Task 3: Build queue-first Tasks and grouped Library

**Files:**
- Modify: `apps/web/src/features/engram/components/tasks-view.tsx`
- Create: `apps/web/src/features/engram/components/library-view.tsx`
- Modify: `apps/web/src/features/engram/store.tsx`
- Modify: `apps/web/src/features/engram/components/quick-capture-bar.tsx`

- [ ] Replace Tasks with a second-sidebar layout: queue filters, group filters, tag filters.
- [ ] Support grouping the visible task list by queue, group, priority, due, or tag.
- [ ] Add a Library view for thoughts and links with second-sidebar filters for type, group, and tag.
- [ ] Make quick-captured tasks default to `Next`; thoughts/links land in Library without inbox language.

## Chunk 4: Verification

### Task 4: Validate

**Files:**
- Validate TypeScript and tests.

- [ ] Run `bun test`.
- [ ] Run `bun run build` or project typecheck/build command.
- [ ] Fix regressions.
