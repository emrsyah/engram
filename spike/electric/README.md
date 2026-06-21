# Phase 0 spike — ElectricSQL → PGlite (IndexedDB)

Throwaway. Proves the read loop before we touch the real schema. Isolated from the
Supabase DB. Delete the whole `spike/` folder when done.

## Prereq
Start **Docker Desktop** (the daemon must be running — check with `docker ps`).

## Run

```bash
cd spike/electric

# 1. Bring up Postgres (logical replication) + Electric. Seeds 3 items (2× u1, 1× u2).
docker compose up -d
docker compose logs -f electric    # wait for "starting" / ready, then Ctrl-C

# 2. CHECKPOINT A — read path, no browser. Postgres → Electric over HTTP.
#    Should return seed-1 and seed-2 only (u1), NOT seed-3 (u2).
curl "http://localhost:3010/v1/shape?table=item&where=user_id%3D'u1'&offset=-1"

# 3. CHECKPOINT B — full path into IndexedDB. Serve the client over http
#    (file:// won't work for module CORS). Any static server:
npx -y serve . -l 5050      # or: python -m http.server 5050
#    Open http://localhost:5050/client.html — expect 2 rows. Reload → still there
#    (loaded from IndexedDB). Check DevTools ▸ Application ▸ IndexedDB ▸ engram-spike.

# 4. CHECKPOINT C — live update. Insert into Postgres, watch the browser update live:
docker compose exec postgres psql -U postgres -d engram_spike -c \
  "INSERT INTO item (id,user_id,space_id,type,title,accent,created_at,updated_at) \
   VALUES ('item-live-1','u1','space-mind','thought','Appeared live!','teal','2026-06-17T01:00:00Z','2026-06-17T01:00:00Z');"
```

## Pass criteria (exit Phase 0)
- [ ] A: curl streams u1's 2 rows, omits u2's → **shape filtering / ownership works**
- [ ] B: client shows 2 rows; survives reload from IndexedDB → **PGlite persistence works**
- [ ] C: the inserted row appears in the browser within ~1s → **live replication works**
- [ ] `tags TEXT[]` array round-trips intact into the browser → **array shapes work**

## Teardown
```bash
docker compose down -v   # -v also drops the postgres volume
```

## Notes / known risks being tested here
- PGlite WASM cold-start time (watch the boot log).
- Electric image pin: `electricsql/electric:latest`. If the shape API path/params
  differ in the pulled version, check `docker compose logs electric` and adjust
  `client.html` (`/v1/shape` params) — the API has been stable but verify.
- The write path is NOT in this spike (that's Phase 3). Checkpoint C writes straight
  to Postgres to isolate the read/replication leg.
