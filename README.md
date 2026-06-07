# Engram

Engram is a local-first spatial workspace for capturing thoughts, tasks, links,
images, and files on a canvas. The canvas is the source of truth; Timeline and
Priorities are projections over the same item records.

The current project is a high-fidelity v1 prototype built in a Bun/Turborepo
monorepo. It persists Engram data in browser `localStorage` through an adapter
boundary that is intended to be replaced by a sync-backed adapter later.

> Note: the generated workspace/package scope is still `alphonse` / `@alphonse`.
> The product and app feature are Engram.

## What Engram Does

- Spatial canvas for notes, tasks, links, images, and file cards.
- Drag cards around an infinite-feeling React Flow canvas.
- Create visible curved links between cards.
- Quick capture for thoughts, tasks, links, and attachments.
- Task priority and due-date capture, including lightweight natural-language
  parsing such as `tomorrow 3pm` and `!p1`.
- Timeline and Priorities views computed from task items.
- Search and jump-to-item behavior.
- Local persistence with validation and corrupt-payload backup.

## Tech Stack

- **Runtime/package manager:** Bun
- **Monorepo:** Turborepo
- **Frontend:** Next.js, React, Tailwind CSS
- **Canvas:** React Flow (`@xyflow/react`)
- **UI primitives:** shadcn-style components in `packages/ui`
- **Backend:** Hono and tRPC
- **Auth:** Better Auth
- **Database:** PostgreSQL with Drizzle ORM for server/auth tables
- **Desktop shell:** Tauri
- **Validation:** Zod
- **Formatting/linting:** Oxlint and Oxfmt

## Repository Layout

```txt
engram/
+-- apps/
|   +-- web/                 # Next.js app and Tauri desktop shell
|   +-- server/              # Hono server, auth routes, tRPC endpoint
+-- packages/
|   +-- api/                 # tRPC router/context package
|   +-- auth/                # Better Auth configuration
|   +-- db/                  # Drizzle config and database schema
|   +-- env/                 # Shared environment validation
|   +-- config/              # Shared TypeScript config
|   +-- ui/                  # Shared UI primitives and global styles
+-- docs/
    +-- plans/               # Product and architecture plans
    +-- superpowers/         # Prototype planning notes
```

The Engram feature itself lives in:

```txt
apps/web/src/features/engram/
+-- engram-core.ts           # Pure domain mutations and invariants
+-- projections.ts           # Timeline, priorities, recent items, search
+-- persistence.ts           # Persistence adapter seam and localStorage adapter
+-- store.tsx                # React store wrapper around the domain core
+-- ui-store.tsx             # UI-only state
+-- types.ts                 # Space, Item, ItemLink, CanvasViewState
+-- components/              # Canvas, sidebar, capture, search, task views
```

## Getting Started

Install dependencies:

```bash
bun install
```

Create `apps/server/.env` for the server and database packages:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/engram
BETTER_AUTH_SECRET=replace-with-at-least-32-characters
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
NODE_ENV=development
```

Create `apps/web/.env.local` for the web app:

```bash
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

Push the Drizzle schema when using the auth/server flow:

```bash
bun run db:push
```

Run the full development stack:

```bash
bun run dev
```

Open the web app at [http://localhost:3001](http://localhost:3001).
The API server runs at [http://localhost:3000](http://localhost:3000).

To run only one side:

```bash
bun run dev:web
bun run dev:server
```

## App Routes

- `/` redirects to `/canvas`
- `/canvas` is the main Engram workspace
- `/timeline` shows task items grouped by time
- `/priorities` shows task items grouped by priority
- `/login` and `/dashboard` are scaffolded auth/dashboard routes

## Development Commands

```bash
bun run dev             # Start all apps through Turborepo
bun run dev:web         # Start only the Next.js app on port 3001
bun run dev:server      # Start only the Hono server on port 3000
bun run build           # Build all apps/packages
bun run check-types     # Typecheck all apps/packages
bun run check           # Run Oxlint and Oxfmt
bun run db:push         # Push Drizzle schema
bun run db:generate     # Generate Drizzle migrations
bun run db:migrate      # Run Drizzle migrations
bun run db:studio       # Open Drizzle Studio
```

Desktop development:

```bash
cd apps/web
bun run desktop:dev
bun run desktop:build
```

Desktop builds use the Tauri app under `apps/web/src-tauri`. Packaging static
web assets may require additional Next.js export/static-build configuration.

## Architecture Notes

Engram keeps domain behavior separate from React and storage:

- `engram-core.ts` owns mutations and invariants.
- `projections.ts` derives read-only views from stored records.
- `persistence.ts` defines the storage adapter boundary.
- `store.tsx` wires React state, domain mutations, and debounced persistence.
- Canvas cards are React Flow nodes, and item links are React Flow edges.

The stored records are intentionally shaped like future synced rows:

- `Space`
- `Item`
- `ItemLink`
- `CanvasViewState`

Tasks are `Item` records, not separate task records. Timeline and Priorities
should remain projections instead of persisted views.

## Current Scope

Implemented for v1:

- Single-user local prototype.
- Local browser persistence.
- Canvas-first data model.
- Search, quick capture, task projections, and link deletion.

Out of scope for v1:

- Real multi-device sync.
- Multi-user collaboration.
- External calendar sync.
- AI features.
- Full file storage pipeline.
- Rich document editing.

See [docs/plans/2026-06-06-engram-design.md](docs/plans/2026-06-06-engram-design.md)
for the detailed product and architecture plan.
