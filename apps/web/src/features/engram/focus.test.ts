import { describe, expect, test } from "bun:test";

import {
  FOCUS_TOP_LIMIT,
  focusBuckets,
  pinToFocus,
  purgeStaleFocusDone,
  reorderFocusPlan,
  setFocusTier,
  sortFocusItems,
  staleFocusDoneIds,
  unpinFromFocus,
} from "./focus";
import type { EngramData, Item } from "./types";

const TODAY = "2026-06-13";
const YESTERDAY = "2026-06-12";

let seq = 0;
function task(overrides: Partial<Item> = {}): Item {
  seq += 1;
  return {
    id: overrides.id ?? `t${seq}`,
    spaceId: "s1",
    type: "task",
    accent: "amber",
    done: false,
    createdAt: `2026-06-13T00:00:${String(seq).padStart(2, "0")}.000Z`,
    updatedAt: "2026-06-13T00:00:00.000Z",
    ...overrides,
  };
}

function dataOf(items: Item[]): EngramData {
  return { spaces: [], items, links: [], viewStates: [], activeSpaceId: "s1" };
}

describe("sortFocusItems", () => {
  test("orders by focusSortOrder, then createdAt", () => {
    const a = task({ id: "a", focusSortOrder: 2, createdAt: "2026-01-01T00:00:00Z" });
    const b = task({ id: "b", focusSortOrder: 0, createdAt: "2026-01-01T00:00:00Z" });
    const c = task({ id: "c", createdAt: "2026-01-01T00:00:01Z" }); // no order → 9999
    const d = task({ id: "d", createdAt: "2026-01-01T00:00:00Z" }); // no order, earlier
    expect(sortFocusItems([a, b, c, d]).map((t) => t.id)).toEqual(["b", "a", "d", "c"]);
  });
});

describe("focusBuckets", () => {
  test("splits pinned tasks into top (capped), backlog, done, legacy", () => {
    const items = [
      task({
        id: "top1",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "top",
        focusSortOrder: 0,
      }),
      task({
        id: "top2",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "top",
        focusSortOrder: 1,
      }),
      task({
        id: "top3",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "top",
        focusSortOrder: 2,
      }),
      task({
        id: "top4",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "top",
        focusSortOrder: 3,
      }),
      task({
        id: "back1",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "backlog",
        focusSortOrder: 4,
      }),
      task({
        id: "done1",
        focusPinned: true,
        focusPlanDate: TODAY,
        focusTier: "top",
        done: true,
        focusSortOrder: 5,
      }),
      task({ id: "leg1", focusPinned: true, focusPlanDate: YESTERDAY, focusTier: "top" }),
    ];
    const b = focusBuckets(items, TODAY);
    expect(b.top.map((t) => t.id)).toEqual(["top1", "top2", "top3"]); // 4th overflows
    expect(b.backlog.map((t) => t.id)).toEqual(["back1", "top4"]); // backlog + overflow
    expect(b.done.map((t) => t.id)).toEqual(["done1"]);
    expect(b.pending.map((t) => t.id)).toEqual(["top1", "top2", "top3", "top4", "back1"]);
    expect(b.legacy.map((t) => t.id)).toEqual(["leg1"]);
    expect(FOCUS_TOP_LIMIT).toBe(3);
  });

  test("ignores unpinned, inbox, and non-task items", () => {
    const items = [
      task({ id: "unpinned" }),
      task({ id: "inboxed", focusPinned: true, inbox: true, focusPlanDate: TODAY }),
      task({ id: "thought", type: "thought", focusPinned: true, focusPlanDate: TODAY }),
    ];
    const b = focusBuckets(items, TODAY);
    expect([...b.top, ...b.backlog, ...b.done, ...b.legacy]).toHaveLength(0);
  });
});

describe("staleFocusDoneIds", () => {
  test("only done tasks with a focusPlanDate before today", () => {
    const items = [
      task({ id: "stale", done: true, focusPlanDate: YESTERDAY }),
      task({ id: "doneToday", done: true, focusPlanDate: TODAY }),
      task({ id: "openYesterday", done: false, focusPlanDate: YESTERDAY }),
      task({ id: "noPlan", done: true }),
    ];
    expect(staleFocusDoneIds(items, TODAY)).toEqual(["stale"]);
  });
});

describe("mutations compose the core", () => {
  test("pinToFocus appends to backlog with next sort order", () => {
    const existing = task({ id: "e", focusPinned: true, focusPlanDate: TODAY, focusSortOrder: 4 });
    const fresh = task({ id: "f" });
    const next = pinToFocus(dataOf([existing, fresh]), "f", TODAY);
    const f = next.items.find((t) => t.id === "f")!;
    expect(f.focusPinned).toBe(true);
    expect(f.focusPlanDate).toBe(TODAY);
    expect(f.focusTier).toBe("backlog");
    expect(f.focusSortOrder).toBe(5);
  });

  test("unpinFromFocus clears all focus fields", () => {
    const pinned = task({
      id: "p",
      focusPinned: true,
      focusPlanDate: TODAY,
      focusTier: "top",
      focusSortOrder: 1,
    });
    const p = unpinFromFocus(dataOf([pinned]), "p").items[0];
    expect(p.focusPinned).toBe(false);
    expect(p.focusPlanDate).toBeUndefined();
    expect(p.focusTier).toBeUndefined();
    expect(p.focusSortOrder).toBeUndefined();
  });

  test("setFocusTier keeps an existing sort order but pins if needed", () => {
    const t = task({ id: "x", focusSortOrder: 7 });
    const x = setFocusTier(dataOf([t]), "x", "top", TODAY).items[0];
    expect(x.focusTier).toBe("top");
    expect(x.focusPinned).toBe(true);
    expect(x.focusPlanDate).toBe(TODAY);
    expect(x.focusSortOrder).toBe(7); // preserved
  });

  test("reorderFocusPlan assigns index as sort order for listed ids only", () => {
    const a = task({ id: "a", focusSortOrder: 0 });
    const b = task({ id: "b", focusSortOrder: 1 });
    const untouched = task({ id: "c", focusSortOrder: 9 });
    const next = reorderFocusPlan(dataOf([a, b, untouched]), ["b", "a"]);
    expect(next.items.find((t) => t.id === "b")!.focusSortOrder).toBe(0);
    expect(next.items.find((t) => t.id === "a")!.focusSortOrder).toBe(1);
    expect(next.items.find((t) => t.id === "c")!.focusSortOrder).toBe(9);
  });

  test("purgeStaleFocusDone deletes stale done tasks and leaves the rest", () => {
    const stale = task({ id: "stale", done: true, focusPlanDate: YESTERDAY });
    const keep = task({ id: "keep", done: true, focusPlanDate: TODAY });
    const next = purgeStaleFocusDone(dataOf([stale, keep]), TODAY);
    expect(next.items.map((t) => t.id)).toEqual(["keep"]);
  });

  test("purgeStaleFocusDone with nothing stale leaves items untouched", () => {
    const keep = task({ id: "keep", done: true, focusPlanDate: TODAY });
    const next = purgeStaleFocusDone(dataOf([keep]), TODAY);
    expect(next.items.map((t) => t.id)).toEqual(["keep"]);
  });
});
