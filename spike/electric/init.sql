-- Phase 0 spike schema: just the `item` entity, trimmed to what proves the loop.
-- Mirrors a slice of apps/web/src/features/engram/types.ts (Item) + a user_id owner
-- column (the future Electric shape filter). String IDs match the app's `item-<uuid>`.

CREATE TABLE item (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  space_id      TEXT NOT NULL,
  type          TEXT NOT NULL,                 -- thought | task | image | link | file
  title         TEXT,
  text          TEXT,
  url           TEXT,
  accent        TEXT NOT NULL DEFAULT 'violet',
  done          BOOLEAN NOT NULL DEFAULT false,
  priority      INTEGER,                        -- 1 | 2 | 3
  due_at        TEXT,
  task_queue    TEXT,                           -- now | next | later | waiting
  tags          TEXT[],                         -- array round-trip test through Electric
  inbox         BOOLEAN NOT NULL DEFAULT false,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Two users so we can prove shape filtering (?where=user_id='u1') isolates owners.
INSERT INTO item (id, user_id, space_id, type, title, accent, priority, task_queue, tags, created_at, updated_at) VALUES
  ('item-seed-1', 'u1', 'space-mind', 'task',    'Wire up Electric spike', 'gold', 1, 'now',   ARRAY['sync','spike'], '2026-06-17T00:00:00.000Z', '2026-06-17T00:00:00.000Z'),
  ('item-seed-2', 'u1', 'space-mind', 'thought', 'PGlite persists to IndexedDB', 'violet', NULL, NULL, ARRAY['idea'],   '2026-06-17T00:01:00.000Z', '2026-06-17T00:01:00.000Z'),
  ('item-seed-3', 'u2', 'space-mind', 'task',    'OTHER user — must NOT sync to u1', 'red', 2, 'later', ARRAY['privacy'], '2026-06-17T00:02:00.000Z', '2026-06-17T00:02:00.000Z');
