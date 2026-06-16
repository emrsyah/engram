/**
 * Lightweight haptic feedback for touch interactions.
 *
 * Haptics are a *secondary action* — always pair them with a visual response.
 * Backed by the Vibration API (Android Chrome / some browsers); a silent no-op
 * where unsupported (notably iOS Safari), so callers never need to guard.
 *
 * Patterns mirror the platform haptic vocabulary: a crisp tick for selection,
 * a soft pulse for success, a sharper double/long buzz for warning/error.
 */
type HapticKind = "selection" | "success" | "warning" | "error" | "impact";

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 8,
  impact: 12,
  success: [10, 40, 10],
  warning: [20, 60, 20],
  error: [30, 50, 30, 50, 30],
};

export function haptic(kind: HapticKind = "selection") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // vibration unavailable or blocked — silently skip
  }
}
