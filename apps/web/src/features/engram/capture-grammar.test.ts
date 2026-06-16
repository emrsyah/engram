import { describe, expect, test } from "bun:test";

import { highlightSegments, parseCapture } from "./capture-grammar";

// A fixed base so due-date math is deterministic: Sat 13 Jun 2026, 09:00 local.
const BASE = new Date(2026, 5, 13, 9, 0, 0);

function dateParts(d: Date) {
  return {
    y: d.getFullYear(),
    mo: d.getMonth(),
    day: d.getDate(),
    h: d.getHours(),
    mi: d.getMinutes(),
  };
}

describe("parseCapture — title & priority", () => {
  test("plain text passes through untouched", () => {
    const r = parseCapture("buy milk", BASE);
    expect(r.cleanText).toBe("buy milk");
    expect(r.priority).toBeUndefined();
    expect(r.dueDate).toBeUndefined();
    expect(r.someday).toBe(false);
    expect(r.tags).toEqual([]);
    expect(r.tokens).toEqual([]);
  });

  test("!1 and !p3 both set priority and are stripped from the title", () => {
    expect(parseCapture("buy milk !1", BASE).priority).toBe(1);
    const r = parseCapture("buy milk !p3", BASE);
    expect(r.priority).toBe(3);
    expect(r.cleanText).toBe("buy milk");
    expect(r.tokens).toContainEqual({ kind: "priority", label: "P3" });
  });

  test("priority at the start is stripped cleanly", () => {
    const r = parseCapture("!2 review", BASE);
    expect(r.priority).toBe(2);
    expect(r.cleanText).toBe("review");
  });
});

describe("parseCapture — tags & mentions", () => {
  test("collects #tags and strips them from the title", () => {
    const r = parseCapture("call mom #family #urgent", BASE);
    expect(r.tags).toEqual(["family", "urgent"]);
    expect(r.cleanText).toBe("call mom");
  });

  test("strips completed @mentions (incl. hyphens) from the title", () => {
    expect(parseCapture("ship it @proj", BASE).cleanText).toBe("ship it");
    expect(parseCapture("ship it @side-project", BASE).cleanText).toBe("ship it");
  });
});

describe("parseCapture — someday & due dates", () => {
  test("'later' defers to someday with no due date", () => {
    const r = parseCapture("draft the post later", BASE);
    expect(r.someday).toBe(true);
    expect(r.dueDate).toBeUndefined();
    expect(r.cleanText).toBe("draft the post");
  });

  test("someday wins over a date phrase", () => {
    const r = parseCapture("draft someday tomorrow", BASE);
    expect(r.someday).toBe(true);
    expect(r.dueDate).toBeUndefined();
  });

  test("'tomorrow' resolves to base + 1 day at start of day", () => {
    const r = parseCapture("meeting tomorrow", BASE);
    expect(r.dueHasTime).toBeFalsy();
    expect(dateParts(r.dueDate!)).toEqual({ y: 2026, mo: 5, day: 14, h: 0, mi: 0 });
    expect(r.cleanText).toBe("meeting");
  });

  test("'tomorrow 3pm' attaches the nearby time", () => {
    const r = parseCapture("meeting tomorrow 3pm", BASE);
    expect(r.dueHasTime).toBe(true);
    expect(dateParts(r.dueDate!)).toEqual({ y: 2026, mo: 5, day: 14, h: 15, mi: 0 });
  });

  test("standalone 'at 12pm' resolves to today noon; '12am' is midnight", () => {
    expect(dateParts(parseCapture("lunch at 12pm", BASE).dueDate!).h).toBe(12);
    expect(dateParts(parseCapture("sleep 12am", BASE).dueDate!).h).toBe(0);
  });

  // RECONCILE #2: parse accepts `at3pm` (no space); highlight does not paint it.
  test("parse accepts 'at3pm' with no space (drift point #2)", () => {
    const r = parseCapture("standup at3pm", BASE);
    expect(r.dueHasTime).toBe(true);
    expect(dateParts(r.dueDate!).h).toBe(15);
    expect(r.cleanText).toBe("standup");
  });
});

describe("highlightSegments", () => {
  test("paints !p1 without the leading space", () => {
    const segs = highlightSegments("buy !p1 milk", ["priority"], false);
    expect(segs).toContainEqual({ text: "!p1", kind: "priority" });
    expect(segs.find((s) => s.kind === "priority")?.text).toBe("!p1");
  });

  test("priority at start has no leading whitespace", () => {
    const segs = highlightSegments("!p1 review", ["priority"], false);
    expect(segs[0]).toEqual({ text: "!p1", kind: "priority" });
  });

  test("paints #tags and ~space triggers", () => {
    expect(highlightSegments("tag #x", ["tag"], false)).toContainEqual({ text: "#x", kind: "tag" });
    expect(highlightSegments("file ~Work", [], true)).toContainEqual({
      text: "~Work",
      kind: "space",
    });
  });

  test("paints a bare @ trigger (drift from parse, which needs @\\w+)", () => {
    expect(highlightSegments("@", ["mention"], false)).toContainEqual({
      text: "@",
      kind: "mention",
    });
  });

  test("paints date words", () => {
    expect(highlightSegments("do it tomorrow", ["date"], false)).toContainEqual({
      text: "tomorrow",
      kind: "date",
    });
  });

  // RECONCILE #3: someday/later are painted with the green "date" colour.
  test("someday is painted as a 'date' segment (drift point #3)", () => {
    expect(highlightSegments("do it someday", ["date"], false)).toContainEqual({
      text: "someday",
      kind: "date",
    });
  });

  // RECONCILE #2: highlight requires a space after "at", so `at3pm` is not painted.
  test("does not paint 'at3pm' (drift point #2)", () => {
    const segs = highlightSegments("standup at3pm", ["date"], false);
    expect(segs.some((s) => s.kind === "date")).toBe(false);
  });

  test("empty input yields no segments", () => {
    expect(highlightSegments("", ["priority", "tag", "date", "mention"], false)).toEqual([]);
  });
});
