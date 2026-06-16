export type EngramView = "board" | "timeline";
export type ItemType = "thought" | "task" | "image" | "link" | "file";
export type Priority = 1 | 2 | 3;
export type Accent = "violet" | "gold" | "teal" | "red" | "blue";
export type FocusTier = "top" | "backlog";
export type TaskQueue = "now" | "next" | "later" | "waiting";

export type ChecklistItem = {
	id: string;
	text: string;
	done: boolean;
};

export type Space = {
	id: string;
	name: string;
	icon: string;
	color: Accent;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
};

export type Item = {
	id: string;
	spaceId: string;
	type: ItemType;
	/** @deprecated Canvas-only fields retained for data-schema backward compat. */
	x?: number;
	/** @deprecated Canvas-only fields retained for data-schema backward compat. */
	y?: number;
	/** @deprecated Canvas-only fields retained for data-schema backward compat. */
	width?: number;
	/** @deprecated Canvas-only fields retained for data-schema backward compat. */
	height?: number;
	title?: string;
	text?: string;
	url?: string;
	source?: string;
	caption?: string;
	accent: Accent;
	done: boolean;
	priority?: Priority;
	dueAt?: string;
	checklistItems?: ChecklistItem[];
	focusPinned?: boolean;
	focusPlanDate?: string;
	focusTier?: FocusTier;
	focusSortOrder?: number;
	taskQueue?: TaskQueue;
	taskSortOrder?: number;
	tags?: string[];
	/** Captured but not yet placed in a space — lives in the Inbox until filed. */
	inbox?: boolean;
	/** Deferred with no due date on purpose (vs. simply undated). */
	someday?: boolean;
	createdAt: string;
	updatedAt: string;
};

export type ItemLink = {
	id: string;
	spaceId: string;
	fromItemId: string;
	toItemId: string;
	createdAt: string;
};

export type DailyBriefingSuggestion = {
	taskId: string;
	reason: string;
	target: FocusTier;
};

export type DailyBriefing = {
	date: string;
	headline: string;
	summary: string;
	topThreeRationale: string[];
	risks: string[];
	suggestedAdjustments: DailyBriefingSuggestion[];
	generatedAt: string;
};

/**
 * @deprecated Canvas-era pan/zoom state. Retained only for persistence
 * backward compat (existing saves include these). No UI reads viewStates
 * anymore; the board does not use a viewport.
 */
export type CanvasViewState = {
	id: string;
	spaceId: string;
	panX: number;
	panY: number;
	zoom: number;
	gridVisible: boolean;
	updatedAt: string;
};

export type EngramData = {
	spaces: Space[];
	items: Item[];
	links: ItemLink[];
	viewStates: CanvasViewState[];
	dailyBriefings?: Record<string, DailyBriefing>;
	activeSpaceId: string;
	selectedItemId?: string;
};
