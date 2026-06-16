import { describe, expect, test } from "bun:test";

import {
  buildItem,
  restoreItems,
  saveDailyBriefing,
  selectItem,
  setActiveSpace,
  setTaskQueue,
  upsertDailyNote,
} from "./engram-core";
import { groupLibraryByTag, groupLibraryByType, groupTasksByQueue } from "./projections";
import type { DailyBriefing, EngramData, Item, ItemLink } from "./types";

let seq = 0;
function item(overrides: Partial<Item> = {}): Item {
  seq += 1;
  return {
    id: overrides.id ?? `i${seq}`,
    spaceId: "s1",
    type: "task",
    accent: "gold",
    done: false,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
    ...overrides,
  };
}

function link(id: string, from: string, to: string, spaceId = "s1"): ItemLink {
  return { id, spaceId, fromItemId: from, toItemId: to, createdAt: "2026-06-13T00:00:00.000Z" };
}

function dataOf(items: Item[], links: ItemLink[] = []): EngramData {
  return { spaces: [], items, links, viewStates: [], activeSpaceId: "s1" };
}

describe("setActiveSpace / selectItem", () => {
  test("setActiveSpace swaps the active space", () => {
    expect(setActiveSpace(dataOf([]), "s9").activeSpaceId).toBe("s9");
  });

  test("selectItem switches to the item's space and selects it", () => {
    const next = selectItem(dataOf([item({ id: "a", spaceId: "s2" })]), "a");
    expect(next.activeSpaceId).toBe("s2");
    expect(next.selectedItemId).toBe("a");
  });

  test("selectItem is a no-op for a missing id", () => {
    const data = dataOf([item({ id: "a" })]);
    expect(selectItem(data, "ghost")).toBe(data);
  });
});

describe("restoreItems", () => {
  test("re-adds deleted items and their still-valid links", () => {
    const surviving = item({ id: "keep", spaceId: "s1" });
    const deletedA = item({ id: "a", spaceId: "s1" });
    const deletedLink = link("l1", "a", "keep");
    const next = restoreItems(dataOf([surviving]), [deletedA], [deletedLink]);
    expect(next.items.map((i) => i.id).sort()).toEqual(["a", "keep"]);
    expect(next.links.map((l) => l.id)).toEqual(["l1"]);
  });

  test("does not duplicate an item that is already present", () => {
    const present = item({ id: "a" });
    const next = restoreItems(dataOf([present]), [present], []);
    expect(next.items.filter((i) => i.id === "a")).toHaveLength(1);
  });

  test("drops a link whose other endpoint is gone", () => {
    const deletedA = item({ id: "a" });
    const danglingLink = link("l1", "a", "vanished");
    const next = restoreItems(dataOf([]), [deletedA], [danglingLink]);
    expect(next.links).toHaveLength(0);
  });

  test("drops a link whose endpoints now live in different spaces", () => {
    const here = item({ id: "a", spaceId: "s1" });
    const moved = item({ id: "b", spaceId: "s2" }); // b moved spaces after the delete
    const crossLink = link("l1", "a", "b", "s1");
    const next = restoreItems(dataOf([moved]), [here], [crossLink]);
    expect(next.links).toHaveLength(0);
  });

  test("drops a self-link and a duplicate of an existing link", () => {
    const a = item({ id: "a" });
    const b = item({ id: "b" });
    const existing = link("present", "a", "b");
    const selfLink = link("l-self", "a", "a");
    const dupReversed = link("l-dup", "b", "a"); // same pair, reversed
    const next = restoreItems(dataOf([a, b], [existing]), [], [selfLink, dupReversed]);
    expect(next.links.map((l) => l.id)).toEqual(["present"]);
  });
});

describe("saveDailyBriefing / upsertDailyNote", () => {
  test("saveDailyBriefing stores by date and replaces", () => {
    const b1 = { date: "2026-06-13", headline: "first" } as unknown as DailyBriefing;
    const b2 = { date: "2026-06-13", headline: "second" } as unknown as DailyBriefing;
    const once = saveDailyBriefing(dataOf([]), b1);
    expect(once.dailyBriefings?.["2026-06-13"]).toBe(b1);
    const twice = saveDailyBriefing(once, b2);
    expect(twice.dailyBriefings?.["2026-06-13"]).toBe(b2);
  });

  test("upsertDailyNote creates the note thought the first time", () => {
    const next = upsertDailyNote(dataOf([]), "2026-06-13", "hello");
    const note = next.items.find((i) => i.type === "thought");
    expect(note?.title).toBe("Daily Note — 2026-06-13");
    expect(note?.text).toBe("hello");
  });

  test("upsertDailyNote updates the existing note instead of adding another", () => {
    const created = upsertDailyNote(dataOf([]), "2026-06-13", "first");
    const updated = upsertDailyNote(created, "2026-06-13", "second");
    const notes = updated.items.filter((i) => i.type === "thought");
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toBe("second");
  });
});

describe("task queues and library projections", () => {
  test("buildItem places new tasks in Backlog by default", () => {
    const next = buildItem({ type: "task", title: "Plan launch" }, dataOf([]));
    expect(next.taskQueue).toBe("later");
    expect(next.taskSortOrder).toBe(0);
  });

  test("setTaskQueue moves a task into the requested queue", () => {
    const original = item({ id: "a", taskQueue: "next" });
    const next = setTaskQueue(dataOf([original]), "a", "now");
    expect(next.items[0].taskQueue).toBe("now");
    expect(next.items[0].taskSortOrder).toBe(0);
  });

  test("groupTasksByQueue treats legacy tasks as Next and completed tasks as Done", () => {
    const grouped = groupTasksByQueue([
      item({ id: "legacy" }),
      item({ id: "now", taskQueue: "now" }),
      item({ id: "done", done: true, taskQueue: "now" }),
    ]);

    expect(grouped.get("next")?.map((i) => i.id)).toEqual(["legacy"]);
    expect(grouped.get("now")?.map((i) => i.id)).toEqual(["now"]);
    expect(grouped.get("done")?.map((i) => i.id)).toEqual(["done"]);
  });

  test("library projections include thoughts and links grouped by type and tag", () => {
    const thought = item({ id: "idea", type: "thought", text: "Maybe", tags: ["product"] });
    const link = item({ id: "link", type: "link", url: "https://example.com", tags: ["product"] });
    const task = item({ id: "task", type: "task", tags: ["product"] });

    expect(groupLibraryByType([thought, link, task]).get("thought")?.map((i) => i.id)).toEqual([
      "idea",
    ]);
    expect(groupLibraryByType([thought, link, task]).get("link")?.map((i) => i.id)).toEqual([
      "link",
    ]);
    expect(groupLibraryByTag([thought, link, task]).get("product")?.map((i) => i.id).sort()).toEqual([
      "idea",
      "link",
    ]);
  });
});
