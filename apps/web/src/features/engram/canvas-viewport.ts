import type { CanvasViewState, Item } from "./types";

/**
 * The canvas coordinate system.
 *
 * Cards are stored in *world* coordinates. The screen shows a pan/zoom window
 * onto that world. Every conversion between the two lives here so the arithmetic
 * (and the magic anchor constants) exists in exactly one place.
 */

export type Point = { x: number; y: number };

type Viewport = Pick<CanvasViewState, "panX" | "panY" | "zoom">;

/** Screen-space point where a freshly captured card is dropped. */
export const CAPTURE_ANCHOR: Point = { x: 520, y: 260 };

/** Screen-space point an item is centered on when jumped to. */
export const VIEWPORT_CENTER: Point = { x: 760, y: 420 };

/** World position for an item with no explicit coordinates and no viewport. */
export const FALLBACK_DROP: Point = { x: 260, y: 220 };

export function screenToWorld(screen: Point, view: Viewport): Point {
  return {
    x: (screen.x - view.panX) / view.zoom,
    y: (screen.y - view.panY) / view.zoom,
  };
}

export function itemCenter(item: Item): Point {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 };
}

/** Pan values that place `world` under the given screen `anchor` at `zoom`. */
export function panToAnchor(
  world: Point,
  anchor: Point,
  zoom: number,
): { panX: number; panY: number } {
  return {
    panX: anchor.x - world.x * zoom,
    panY: anchor.y - world.y * zoom,
  };
}
