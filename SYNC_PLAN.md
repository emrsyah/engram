# Engram Sync Plan — ElectricSQL + PGlite (Postgres ⇄ IndexedDB)

> Status: PROPOSED (2026-06-17). Goal: replace the localStorage prototype with a
> local-first sync layer that feels snappy/Linear-like while keeping infra minimal.

## Decision

**Read path:** ElectricSQL streams Postgres → client over HTTP as *shapes* (filtered
queries), landing in a local **PGlite** database persisted to **IndexedDB** (`idb://engram`).
Reads are local and instant.

**Write path:** stays on our existing **Hono + tRPC + Drizzle + Better Auth** stack.
The client writes optimistically to local state, fires a tRPC mutation, and lets the
Electric shape stream reconcile when the change echoes back.

Why Electric over PowerSync/Zero: it's a single stateless proxy in front of our
*existing* Postgres (no second DB, no sync service), and it leaves our write API
where it already is. PowerSync is the upgrade path **iff** we later need a robust
long-offline write queue. (Full research in chat 2026-06-17.)

### Why this is low-churn here
- `EngramData` is already normalized (`spaces[] / items[] / links[]`) → maps 1:1 to tables.
- `engram-core.ts` mutations are pure `EngramData → EngramData` → reuse them **server-side**
  against Drizzle so invariants enforce identically on both ends.
- `persistence.ts` is already an adapter seam (`EngramPersistence`) → add an Electric-backed
  impl; `store.tsx`, `projections.ts`, views stay essentially untouched.

---

## Target architecture

```
            writes (tRPC: createItem, patchItem, addLink, …)
   client ───────────────────────────────────────────────►  Hono/tRPC  ──► Drizzle ──► Postgres
     │  optimistic apply to local store                                                    │
     │                                                                                      │ logical
     ▼                                                                                      ▼ replication
   PGlite (idb://engram)  ◄──────────── Electric shapes (HTTP, filtered by userId) ◄──── Electric proxy
     │
     ▼ hydrate
   EngramData-shaped store  →  projections  →  views   (UNCHANGED)
```

Two seams change; everything above the store stays put:
1. `persistence.ts` → new `createElectricAdapter()` (PGlite + shape subscriptions).
2. `packages/api` tRPC stubs → real mutations calling reused `engram-core` logic.

---

## Data model migration (localStorage blob → Postgres tables)

New Drizzle file `packages/db/src/schema/engram.ts`, re-exported from `schema/index.ts`.
Every table gets a `user_id` FK (the shape filter + ownership boundary). IDs stay the
app's existing string IDs (`item-<uuid>`, etc.) so no remapping.

Tables (columns straight from `types.ts`):
- **space** — id, userId, name, icon, color, sortOrder, createdAt, updatedAt
- **item** — id, userId, spaceId, type, title, text, url, source, caption, accent, done,
  priority, dueAt, focusPinned, focusPlanDate, focusTier, focusSortOrder, taskQueue,
  taskSortOrder, tags (text[]/jsonb), inbox, someday, createdAt, updatedAt
  - `checklistItems` → child table **checklist_item** (id, itemId, text, done, sortOrder)
    OR jsonb column. **Decision needed** (see open questions).
- **item_link** — id, userId, spaceId, fromItemId, toItemId, createdAt
- **daily_briefing** — date, userId, headline, summary, topThreeRationale (jsonb),
  risks (jsonb), suggestedAdjustments (jsonb), generatedAt

**Dropped:** `viewStates` / `CanvasViewState` and `x/y/width/height` (already
`@deprecated`; this is the moment to delete, not migrate).

Indexes: `(user_id)` on every table; `(space_id)` on item/item_link.

---

## Phased plan (each phase ships green: `tsc --noEmit` + existing tests pass)

### Phase 0 — Spike (de-risk, throwaway)
- Stand up Electric proxy locally against the dev Postgres (Docker).
- One shape (`item WHERE user_id = …`) syncing into PGlite `idb://engram-spike`.
- Confirm: persistence survives reload, shape filters by user, write→reconcile loop works
  for a single `item` insert via a throwaway tRPC mutation.
- **Exit:** we've seen the full loop on one entity before committing to the rest.

### Phase 1 — Schema & server writes (no client wiring yet)
- Add `schema/engram.ts` + relations; `bun db:generate` + `db:push`.
- Port `seed.ts` into a server seeder (per-user) so a fresh user lands with demo data.
- Implement tRPC `engram` router mutations by reusing `engram-core.ts` transforms over
  Drizzle (createItem, patchItem, toggleItemDone, addLink, removeLink, addSpace, …).
  Each mutation re-checks the same invariants and scopes by `ctx.session.user.id`.
- **Exit:** mutations callable + unit-tested server-side; client still on localStorage.

### Phase 2 — Electric read path + Electric persistence adapter
- Add PGlite + `electricSync()` on the client; subscribe shapes scoped to the session user.
- New `createElectricAdapter(): EngramPersistence` whose `load()` hydrates `EngramData`
  from PGlite tables (preserve the existing in-memory shape so projections don't change).
- Swap `const persistence = createLocalStorageAdapter()` in `store.tsx` behind an env flag
  so we can A/B the two adapters during rollout.
- **Exit:** app reads live from PGlite; reload restores from IndexedDB; multi-tab consistent.

### Phase 3 — Optimistic writes through tRPC
- Route store mutations: apply locally (React 19 `useOptimistic`/local set) → call tRPC →
  drop optimistic entry when the shape stream echoes the row back (Electric `matchStream`).
- Reconcile rules: last-write-wins per row using `updatedAt` (matches current core
  semantics); links remain space-scoped + dedup-checked server-side.
- Replace the 120ms debounce-save (no longer the persistence path; PGlite + tRPC own it).
- **Exit:** create/edit/complete/link all feel instant and survive offline blips.

### Phase 4 — Cutover & cleanup
- One-time localStorage→Postgres importer (read `engram.prototype.v1`, POST via tRPC,
  then mark migrated). Keep the localStorage adapter for ~1 release as a fallback.
- Remove deprecated canvas fields/types once persistence no longer carries them.
- Delete env flag; Electric is the only path.

---

## What stays the same (the win)
- `types.ts` domain model (minus deprecated canvas fields).
- `projections.ts` — all read lenses unchanged (still pure fns over `EngramData`).
- `engram-core.ts` — now runs in **two** places (client optimistic + server authoritative).
- `store.tsx` public `EngramStore` API — components don't notice the swap.
- Better Auth, Hono, the whole `apps/server` shell.

## Open questions (resolve before Phase 1)
1. **checklistItems**: child table (clean relational, more shapes) vs jsonb column
   (fewer moving parts, matches current nested shape). Leaning **jsonb** for Phase 1 speed.
2. **tags**: Postgres `text[]` vs jsonb. Leaning `text[]` (indexable for tag grouping).
3. **Electric hosting**: self-host the proxy in our own infra now, or Electric Cloud?
   "Minimal infra" → self-host one container next to Postgres.
4. **dailyBriefings**: sync via Electric too, or keep server-only behind the existing
   `/api/focus/briefing` route? Leaning sync-too for offline reads.
5. **Multi-device conflict depth**: LWW-by-`updatedAt` is fine for single-user; confirm we
   don't need field-level merge yet.

## Risks
- PGlite WASM bundle size / cold-start on first load — measure in Phase 0.
- Logical replication must be enabled on Postgres (Electric requirement) — verify with host.
- `tags`/`jsonb` array shapes over Electric — validate they round-trip in the spike.
</content>
</invoke>
