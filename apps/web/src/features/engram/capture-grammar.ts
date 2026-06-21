// ─────────────────────────────────────────────────────────────────────────────
// Capture grammar — the single source of truth for the quick-capture syntax.
//
// Two consumers, two entry points, ONE set of rules:
//   • highlightSegments() — used by <CaptureInput> on every keystroke to paint
//     live syntax highlighting. Returns display segments; computes no dates.
//   • parseCapture()      — used by <QuickCaptureBar> on commit to turn the raw
//     string into an Item payload (clean title + priority/due/tags/someday).
//
// Both read from the token patterns defined below, so a rule added or fixed here
// shows up in highlighting AND parsing — they can no longer drift apart.
//
// NOTE — three places where the two paths still disagree are preserved exactly
// (see the `RECONCILE` comments). They are tracked for a follow-up; this module
// is a behaviour-preserving extraction, not a behaviour change.
// ─────────────────────────────────────────────────────────────────────────────

import { startOfDay } from "date-fns";

import type { Priority } from "./types";

// ── Escape marker ─────────────────────────────────────────────────────────
// A zero-width word-joiner (U+2060) inserted immediately before a token to
// "cancel" it: the word stays as literal text but is no longer parsed or
// highlighted. Every token pattern below either breaks naturally on the marker
// (priority, which requires `^|\s` before `!`) or carries a `(?<!⁠)`
// lookbehind so an escaped occurrence is skipped. parseCapture strips the
// marker from the title before the item is created.
export const ESCAPE = "⁠";

// ── Token patterns ──────────────────────────────────────────────────────────

// Priority: `!1`, `!p2`, ` !p3`. Capture group 1 is the digit (used by parse;
// ignored by highlight). The same span matches for both paths. The `^|\s`
// requirement means an ESCAPE before `!` already prevents a match.
const PRIORITY_RE = /(?:^|\s)!(?:p)?([123])\b/i;

// Tags: `#focus`, `#side-project`. Capture group 1 is the tag name.
const TAG_RE = /(?<!⁠)#(\w[\w-]*)/g;

// Mentions. The two paths intentionally differ:
//   • PARSE strips completed mentions (`@foo`, `@foo-bar`) from the title.
//   • HIGHLIGHT paints the in-progress trigger too (bare `@`, no hyphens) so the
//     mention popup has something to anchor to while typing.
const MENTION_STRIP_RE = /(?:^|\s)@\w[\w-]*/g;
const MENTION_HIGHLIGHT_RE = /@\w*/g;

// `~space` trigger — highlight only (parse never sees it; spaces are chosen via
// the popup, not the title text).
const SPACE_TRIGGER_RE = /~\S*/g;

// "Someday"/"later" defers with no due date and wins over date parsing.
const SOMEDAY_RE = /(?<!⁠)\b(?:someday|later)\b/i;

// Relative day phrases, in priority order, with their day offset from `base`.
const DUE_PHRASES: { regex: RegExp; offsetDays: number; label: string }[] = [
  { regex: /(?<!⁠)\btonight\b/i, offsetDays: 0, label: "Tonight" },
  { regex: /(?<!⁠)\btoday\b/i, offsetDays: 0, label: "Today" },
  { regex: /(?<!⁠)\btomorrow\b/i, offsetDays: 1, label: "Tomorrow" },
  { regex: /(?<!⁠)\bnext week\b/i, offsetDays: 7, label: "Next week" },
];

// Clock time near a day phrase, or standalone. Parse allows `at3pm` (\s*).
const DUE_TIME_RE = /(?<!⁠)\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const DUE_TIME_AFTER_RE = /^\s*(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
const DUE_TIME_BEFORE_RE = /\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*$/i;

// RECONCILE #1 (priority): highlight historically used `/(^|\s)(!p?[123])\b/gi`
//   — same matched span as PRIORITY_RE, so unified here with no behaviour change.
// RECONCILE #2 (time): highlight historically required `at\s+` (one+ space), so
//   `at3pm` highlights differently than it parses. Preserved via the separate
//   HIGHLIGHT date/time patterns below.
// RECONCILE #3 (someday colour): highlight lumps someday/later into the green
//   "date" colour, while parse treats them as a distinct "someday" token.
//   Preserved via HIGHLIGHT_DATE_WORD_RE below.
const HIGHLIGHT_DATE_WORD_RE = /(?<!⁠)\b(?:tonight|today|tomorrow|next week|someday|later)\b/gi;
const HIGHLIGHT_TIME_RE = /(?<!⁠)\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi;

// ── parseCapture: raw string → Item payload ─────────────────────────────────

export type ParsedCapture = {
  cleanText: string;
  priority?: Priority;
  dueDate?: Date;
  dueHasTime?: boolean;
  someday?: boolean;
  tags: string[];
  tokens: { kind: "priority" | "date" | "tag" | "someday"; label: string }[];
};

export function parseCapture(value: string, base = new Date()): ParsedCapture {
  let cleanText = value;
  const tokens: ParsedCapture["tokens"] = [];

  const priorityMatch = cleanText.match(PRIORITY_RE);
  const priority = priorityMatch ? (Number(priorityMatch[1]) as Priority) : undefined;
  if (priorityMatch) {
    tokens.push({ kind: "priority", label: `P${priority}` });
    cleanText = cleanText.replace(priorityMatch[0], priorityMatch[0].startsWith(" ") ? " " : "");
  }

  // Strip @mentions — these become explicit node connections, not part of the title.
  cleanText = cleanText.replace(MENTION_STRIP_RE, "");

  const tagMatches = [...cleanText.matchAll(TAG_RE)];
  const tags = tagMatches.map((m) => m[1]);
  for (const tag of tags) {
    tokens.push({ kind: "tag", label: `#${tag}` });
    cleanText = cleanText.replace(`#${tag}`, "");
  }

  const somedayMatch = cleanText.match(SOMEDAY_RE);
  let someday = false;
  if (somedayMatch) {
    someday = true;
    tokens.push({ kind: "someday", label: "Someday" });
    cleanText = cleanText.replace(somedayMatch[0], "");
  }

  const parsedDue = someday ? null : parseDuePhrase(cleanText, base);
  if (parsedDue) {
    tokens.push({ kind: "date", label: parsedDue.label });
    cleanText = cleanText.slice(0, parsedDue.start) + cleanText.slice(parsedDue.end);
  }

  return {
    // Drop any escape markers so cancelled words read as plain text in the title.
    cleanText: cleanText.replaceAll(ESCAPE, "").replace(/\s{2,}/g, " ").trim(),
    priority,
    dueDate: parsedDue?.date,
    dueHasTime: parsedDue?.hasTime,
    someday,
    tags,
    tokens,
  };
}

/**
 * "Cancel" a parsed token: insert an ESCAPE marker before its occurrence in
 * `value` so the word stays as literal text but is no longer parsed/highlighted.
 * Returns the new string (marker is zero-width, so the visible text is unchanged).
 */
export function cancelToken(value: string, token: ParsedCapture["tokens"][number]): string {
  if (token.kind === "priority") {
    const m = value.match(PRIORITY_RE);
    if (!m || m.index === undefined) return value;
    // Skip the leading whitespace so the marker lands right before `!`.
    const lead = m[0].length - m[0].replace(/^\s+/, "").length;
    return insertEscape(value, [m.index + lead]);
  }
  if (token.kind === "someday") {
    const m = value.match(SOMEDAY_RE);
    return m?.index === undefined ? value : insertEscape(value, [m.index]);
  }
  if (token.kind === "tag") {
    // token.label is like "#focus" — escape that exact, not-yet-escaped tag.
    const escaped = token.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!${ESCAPE})${escaped}\\b`);
    const m = value.match(re);
    return m?.index === undefined ? value : insertEscape(value, [m.index]);
  }
  // date — escape every day-phrase and standalone time so "tomorrow 3pm" fully cancels.
  const indices: number[] = [];
  for (const phrase of DUE_PHRASES) {
    const m = value.match(phrase.regex);
    if (m?.index !== undefined) indices.push(m.index);
  }
  const time = value.match(DUE_TIME_RE);
  if (time?.index !== undefined) indices.push(time.index);
  return indices.length ? insertEscape(value, indices) : value;
}

/** Insert a single ESCAPE marker before `index`, cancelling the token that starts there. */
export function escapeBefore(value: string, index: number): string {
  return insertEscape(value, [index]);
}

/** Insert the ESCAPE marker at each index, right-to-left so earlier offsets stay valid. */
function insertEscape(value: string, indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => b - a);
  let out = value;
  for (const index of sorted) out = out.slice(0, index) + ESCAPE + out.slice(index);
  return out;
}

function parseDuePhrase(value: string, base: Date) {
  for (const pattern of DUE_PHRASES) {
    const match = value.match(pattern.regex);
    if (!match || match.index === undefined) continue;
    const date = startOfDay(new Date(base));
    date.setDate(date.getDate() + pattern.offsetDays);
    const time = parseTimeNear(value, match.index, match.index + match[0].length);
    if (time) {
      date.setHours(time.hours, time.minutes, 0, 0);
    }
    return {
      date,
      label: time ? `${pattern.label} ${time.label}` : pattern.label,
      hasTime: !!time,
      start: time?.start ?? match.index,
      end: time?.end ?? match.index + match[0].length,
    };
  }

  const timeOnly = value.match(DUE_TIME_RE);
  if (timeOnly?.index !== undefined) {
    const date = startOfDay(new Date(base));
    const time = normalizeTime(timeOnly[1], timeOnly[2], timeOnly[3]);
    date.setHours(time.hours, time.minutes, 0, 0);
    return {
      date,
      label: `Today ${time.label}`,
      hasTime: true,
      start: timeOnly.index,
      end: timeOnly.index + timeOnly[0].length,
    };
  }

  return null;
}

function parseTimeNear(value: string, start: number, end: number) {
  const after = value.slice(end, end + 16);
  const before = value.slice(Math.max(0, start - 16), start);
  const afterMatch = after.match(DUE_TIME_AFTER_RE);
  if (afterMatch) {
    const time = normalizeTime(afterMatch[1], afterMatch[2], afterMatch[3]);
    return { ...time, start, end: end + afterMatch[0].length };
  }
  const beforeMatch = before.match(DUE_TIME_BEFORE_RE);
  if (beforeMatch && beforeMatch.index !== undefined) {
    const time = normalizeTime(beforeMatch[1], beforeMatch[2], beforeMatch[3]);
    const tokenStart = start - before.length + beforeMatch.index;
    return { ...time, start: tokenStart, end };
  }
  return null;
}

function normalizeTime(hourText: string, minuteText: string | undefined, meridiem: string) {
  const hour = Number(hourText);
  const minutes = minuteText ? Number(minuteText) : 0;
  const lower = meridiem.toLowerCase();
  const hours = lower === "pm" && hour < 12 ? hour + 12 : lower === "am" && hour === 12 ? 0 : hour;
  return {
    hours,
    minutes,
    label: `${hour}:${String(minutes).padStart(2, "0")}${lower}`,
  };
}

// ── highlightSegments: raw string → display segments ────────────────────────

export type CaptureToken = "priority" | "tag" | "date" | "mention" | "space";

export type Segment = { text: string; kind: "plain" | CaptureToken };
type Range = { start: number; end: number; kind: CaptureToken };

function collectSimple(text: string, re: RegExp, kind: CaptureToken, out: Range[]) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, kind });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
}

export function highlightSegments(
  text: string,
  enabled: CaptureToken[],
  spaceHighlight: boolean,
): Segment[] {
  if (!text) return [];
  const ranges: Range[] = [];

  if (enabled.includes("priority")) {
    const re = new RegExp(PRIORITY_RE.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      // Skip the leading whitespace (if any) so only `!p1` is painted.
      const lead = m[0].length - m[0].replace(/^\s+/, "").length;
      ranges.push({ start: m.index + lead, end: m.index + m[0].length, kind: "priority" });
    }
  }
  if (enabled.includes("tag")) collectSimple(text, TAG_RE, "tag", ranges);
  if (enabled.includes("mention")) collectSimple(text, MENTION_HIGHLIGHT_RE, "mention", ranges);
  if (spaceHighlight) collectSimple(text, SPACE_TRIGGER_RE, "space", ranges);
  if (enabled.includes("date")) {
    collectSimple(text, HIGHLIGHT_DATE_WORD_RE, "date", ranges);
    collectSimple(text, HIGHLIGHT_TIME_RE, "date", ranges);
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: Range[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start < lastEnd) continue;
    accepted.push(r);
    lastEnd = r.end;
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of accepted) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), kind: "plain" });
    segments.push({ text: text.slice(r.start, r.end), kind: r.kind });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: "plain" });
  return segments;
}
