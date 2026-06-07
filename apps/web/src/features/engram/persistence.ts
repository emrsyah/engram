import { z } from "zod";

import { TODAY_FOCUS_SPACE_ID } from "./config";
import { seedViewStates } from "./seed";
import type { EngramData } from "./types";

/**
 * The Engram persistence adapter seam.
 *
 * The canvas and store never touch browser storage or a sync SDK directly —
 * they go through this interface. The localStorage adapter satisfies it today;
 * a PowerSync adapter can satisfy it later without rewriting the canvas.
 */

export type LoadResult =
	| { status: "empty" }
	| { status: "ok"; data: EngramData }
	| { status: "corrupt"; raw: string };

export interface EngramPersistence {
	load(): LoadResult;
	save(data: EngramData): void;
}

const STORAGE_KEY = "engram.prototype.v1";
const STORAGE_BACKUP_KEY = "engram.prototype.v1.backup";

// Zod schemas — validate the shape at the persistence boundary so the rest of
// the app can trust it receives well-formed EngramData.
const SpaceSchema = z.object({
	id: z.string(),
	name: z.string(),
	icon: z.string(),
	sortOrder: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const ChecklistItemSchema = z.object({
	id: z.string(),
	text: z.string(),
	done: z.boolean(),
});

const ItemSchema = z.object({
	id: z.string(),
	spaceId: z.string(),
	type: z.enum(["thought", "task", "image", "link", "file"]),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	title: z.string().optional(),
	text: z.string().optional(),
	url: z.string().optional(),
	source: z.string().optional(),
	caption: z.string().optional(),
	accent: z.enum(["violet", "gold", "teal", "red", "blue"]),
	done: z.boolean(),
	priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
	dueAt: z.string().optional(),
	checklistItems: z.array(ChecklistItemSchema).optional(),
	focusPinned: z.boolean().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const ItemLinkSchema = z.object({
	id: z.string(),
	spaceId: z.string(),
	fromItemId: z.string(),
	toItemId: z.string(),
	createdAt: z.string(),
});

const CanvasViewStateSchema = z.object({
	id: z.string(),
	spaceId: z.string(),
	panX: z.number(),
	panY: z.number(),
	zoom: z.number(),
	gridVisible: z.boolean(),
	updatedAt: z.string(),
});

const EngramDataSchema = z.object({
	spaces: z.array(SpaceSchema),
	items: z.array(ItemSchema),
	links: z.array(ItemLinkSchema),
	viewStates: z.array(CanvasViewStateSchema),
	activeSpaceId: z.string(),
	selectedItemId: z.string().optional(),
});

export function createLocalStorageAdapter(): EngramPersistence {
	return {
		load() {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) {
				return { status: "empty" };
			}

			try {
				const parsed: unknown = JSON.parse(raw);
				const result = EngramDataSchema.safeParse(parsed);
				if (!result.success) {
					throw new Error(result.error.message);
				}
				const data = result.data;
				// Ensure Today's Focus space always exists (migrate existing saves).
				const hasTFSpace = data.spaces.some(
					(s) => s.id === TODAY_FOCUS_SPACE_ID,
				);
				const hasTFView = data.viewStates.some(
					(v) => v.spaceId === TODAY_FOCUS_SPACE_ID,
				);
				const tfSpace = {
					id: "space-today-focus",
					name: "Today's Focus",
					icon: "target",
					sortOrder: -1,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
				const tfView = seedViewStates.find(
					(v) => v.spaceId === TODAY_FOCUS_SPACE_ID,
				) ?? { id: "view-today-focus", spaceId: TODAY_FOCUS_SPACE_ID, panX: 100, panY: 100, zoom: 1, gridVisible: true, updatedAt: new Date().toISOString() };
				return {
					status: "ok",
					data: {
						...data,
						spaces: hasTFSpace ? data.spaces : [tfSpace, ...data.spaces],
						viewStates: hasTFView
							? data.viewStates
							: [...data.viewStates, tfView],
					},
				};
			} catch {
				localStorage.setItem(STORAGE_BACKUP_KEY, raw);
				return { status: "corrupt", raw };
			}
		},

		save(data) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		},
	};
}
