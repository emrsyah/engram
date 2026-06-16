import { z } from "zod";

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
	color: z.enum(["violet", "gold", "teal", "red", "blue"]).default("violet"),
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
	/** @deprecated canvas-era fields; optional for backward compat */
	x: z.number().optional(),
	y: z.number().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
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
	focusPlanDate: z.string().optional(),
	focusTier: z.enum(["top", "backlog"]).optional(),
	focusSortOrder: z.number().optional(),
	taskQueue: z.enum(["now", "next", "later", "waiting"]).optional(),
	taskSortOrder: z.number().optional(),
	tags: z.array(z.string()).optional(),
	inbox: z.boolean().optional(),
	someday: z.boolean().optional(),
	// clusterId and sortOrder accepted but stripped at load time (forward compat
	// for any existing saves that still carry these fields).
	clusterId: z.string().optional(),
	sortOrder: z.number().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
}).transform(({ clusterId: _c, sortOrder: _s, ...rest }) => rest);

const ItemLinkSchema = z.object({
	id: z.string(),
	spaceId: z.string(),
	fromItemId: z.string(),
	toItemId: z.string(),
	createdAt: z.string(),
});

const DailyBriefingSuggestionSchema = z.object({
	taskId: z.string(),
	reason: z.string(),
	target: z.enum(["top", "backlog"]),
});

const DailyBriefingSchema = z.object({
	date: z.string(),
	headline: z.string(),
	summary: z.string(),
	topThreeRationale: z.array(z.string()),
	risks: z.array(z.string()),
	suggestedAdjustments: z.array(DailyBriefingSuggestionSchema),
	generatedAt: z.string(),
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
	dailyBriefings: z.record(z.string(), DailyBriefingSchema).optional(),
	// clusters field silently ignored if present in old saves.
	clusters: z.array(z.unknown()).optional(),
	activeSpaceId: z.string(),
	selectedItemId: z.string().optional(),
}).transform(({ clusters: _clusters, ...rest }) => rest);

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
				return {
					status: "ok",
					data,
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
