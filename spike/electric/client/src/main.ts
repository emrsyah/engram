import { PGlite } from "@electric-sql/pglite";
import { live } from "@electric-sql/pglite/live";
import { electricSync } from "@electric-sql/pglite-sync";

const log = (msg: string, cls = "") => {
  const el = document.getElementById("log")!;
  el.innerHTML += `\n${cls ? `<span class="${cls}">${msg}</span>` : msg}`;
};

async function main() {
  log("booting PGlite (idb://engram-spike)…");
  const pg = await PGlite.create({
    dataDir: "idb://engram-spike",
    extensions: { live, electric: electricSync() },
  });

  await pg.exec(`
    CREATE TABLE IF NOT EXISTS item (
      id TEXT PRIMARY KEY, user_id TEXT, space_id TEXT, type TEXT,
      title TEXT, text TEXT, url TEXT, accent TEXT, done BOOLEAN,
      priority INTEGER, due_at TEXT, task_queue TEXT, tags TEXT[],
      inbox BOOLEAN, created_at TEXT, updated_at TEXT
    );
  `);
  log("PGlite ready", "ok");

  // The read path: a filtered Electric shape → local table.
  await pg.electric.syncShapeToTable({
    shape: {
      url: "http://localhost:3010/v1/shape",
      params: { table: "item", where: "user_id = 'u1'" },
    },
    table: "item",
    primaryKey: ["id"],
    shapeKey: "item-u1",
  });
  log("shape subscribed: item where user_id=u1", "ok");

  // Live query → re-renders on initial load AND streamed updates.
  pg.live.query<{
    id: string; title: string | null; text: string | null; url: string | null;
    type: string; user_id: string; tags: string[] | null;
  }>("SELECT * FROM item ORDER BY created_at", [], (res) => {
    const rows = res.rows;
    document.getElementById("items")!.innerHTML = rows.length
      ? rows
          .map(
            (r) =>
              `<div class="row"><b>${r.title ?? r.text ?? r.url}</b>
               <div class="meta">${r.type} · ${r.user_id} · ${(r.tags ?? []).join(", ")}</div></div>`,
          )
          .join("")
      : "<i>no rows</i>";
    log(`live render: ${rows.length} row(s)`);
  });
}

main().catch((e) => {
  log("FAILED: " + (e?.message ?? e), "err");
  console.error(e);
});
