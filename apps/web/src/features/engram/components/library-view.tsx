"use client";

import { Button } from "@alphonse/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { Input } from "@alphonse/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import { useState } from "react";

import type { LibraryType } from "../projections";
import { useEngramStore } from "../store";
import type { Item, Space } from "../types";
import { useUIStore } from "../ui-store";
import { usePersistentState } from "../use-persistent-state";
import { Icons } from "./icons";

type LibraryFilter =
	| { kind: "all"; value: "all" }
	| { kind: "type"; value: LibraryType }
	| { kind: "group"; value: string }
	| { kind: "tag"; value: string };

type LibraryGroupBy = "none" | "type" | "group" | "tag";
type LibraryViewMode = "list" | "moodboard" | "card";
type LibraryOrderField = "date" | "title" | "type";
type LibraryOrderDir = "asc" | "desc";

/** Durable view preferences — persisted across navigation and reload. */
type LibraryPrefs = {
	filter: LibraryFilter;
	groupBy: LibraryGroupBy;
	viewMode: LibraryViewMode;
	orderField: LibraryOrderField;
	orderDir: LibraryOrderDir;
};

const LIBRARY_PREFS_KEY = "engram.library.prefs.v1";
const DEFAULT_LIBRARY_PREFS: LibraryPrefs = {
	filter: { kind: "all", value: "all" },
	groupBy: "none",
	viewMode: "card",
	orderField: "date",
	orderDir: "desc",
};

const LIBRARY_TYPES: { id: LibraryType; label: string }[] = [
	{ id: "thought", label: "Ideas" },
	{ id: "link", label: "Links" },
];

const VIEW_MODES: { id: LibraryViewMode; label: string; icon: keyof typeof Icons }[] = [
	{ id: "list", label: "List", icon: "list" },
	{ id: "moodboard", label: "Moodboard", icon: "image" },
	{ id: "card", label: "Cards", icon: "layout" },
];

const ORDER_FIELDS: { id: LibraryOrderField; label: string }[] = [
	{ id: "date", label: "Date added" },
	{ id: "title", label: "Title" },
	{ id: "type", label: "Type" },
];

const GROUP_BY_OPTIONS: { id: LibraryGroupBy; label: string }[] = [
	{ id: "none", label: "None" },
	{ id: "type", label: "Type" },
	{ id: "group", label: "Group" },
	{ id: "tag", label: "Tag" },
];

function itemTitle(item: Item) {
	return item.title ?? item.text ?? item.url ?? "Untitled";
}

function itemBody(item: Item) {
	if (item.type === "link") return item.url;
	return item.text;
}

function spaceName(spaces: Space[], id: string) {
	return spaces.find((space) => space.id === id)?.name ?? "Ungrouped";
}

function isValidUrl(value: string) {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

function extractDomain(url: string) {
	try {
		return new URL(url).hostname.replace("www.", "");
	} catch {
		return url;
	}
}

/** A favicon preview pulled from the link's domain — best-effort, no backend. */
function faviconUrl(url: string) {
	try {
		const domain = new URL(url).hostname;
		return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
	} catch {
		return undefined;
	}
}

function sortItems(items: Item[], field: LibraryOrderField, dir: LibraryOrderDir) {
	const factor = dir === "asc" ? 1 : -1;
	return items.toSorted((a, b) => {
		let cmp = 0;
		if (field === "title") cmp = itemTitle(a).localeCompare(itemTitle(b));
		else if (field === "type") cmp = a.type.localeCompare(b.type);
		else cmp = a.createdAt.localeCompare(b.createdAt);
		if (cmp === 0) cmp = a.createdAt.localeCompare(b.createdAt);
		return cmp * factor;
	});
}

export function LibraryView() {
	const { allTags, createItem, libraryItems, spaces } = useEngramStore();
	const { openDetail } = useUIStore();
	const [prefs, setPrefs] = usePersistentState<LibraryPrefs>(LIBRARY_PREFS_KEY, DEFAULT_LIBRARY_PREFS);
	const [text, setText] = usePersistentState<string>("engram.library.draft.v1", "");

	const setFilter = (filter: LibraryFilter) => setPrefs((p) => ({ ...p, filter }));
	const setGroupBy = (groupBy: LibraryGroupBy) => setPrefs((p) => ({ ...p, groupBy }));
	const setViewMode = (viewMode: LibraryViewMode) => setPrefs((p) => ({ ...p, viewMode }));
	const setOrderField = (orderField: LibraryOrderField) => setPrefs((p) => ({ ...p, orderField }));
	const toggleOrderDir = () =>
		setPrefs((p) => ({ ...p, orderDir: p.orderDir === "asc" ? "desc" : "asc" }));

	const defaultSpaceId = spaces[0]?.id;
	const libraryTags = allTags.filter((tag) => libraryItems.some((item) => item.tags?.includes(tag)));

	const filter = prefs.filter;
	const visibleItems =
		filter.kind === "type"
			? libraryItems.filter((item) => item.type === filter.value)
			: filter.kind === "group"
				? libraryItems.filter((item) => item.spaceId === filter.value)
				: filter.kind === "tag"
					? libraryItems.filter((item) => item.tags?.includes(filter.value))
					: libraryItems;
	const sortedItems = sortItems(visibleItems, prefs.orderField, prefs.orderDir);
	const groupedItems = buildLibraryGroups(sortedItems, prefs.groupBy, spaces);
	const activeFilterLabel =
		filter.kind === "type"
			? (LIBRARY_TYPES.find((type) => type.id === filter.value)?.label ?? "Type")
			: filter.kind === "group"
				? spaceName(spaces, filter.value)
				: filter.kind === "tag"
					? `#${filter.value}`
					: "All library";
	const activeOrderLabel = ORDER_FIELDS.find((o) => o.id === prefs.orderField)?.label ?? "Date added";

	const addLibraryItem = () => {
		const value = text.trim();
		if (!value || !defaultSpaceId) return;
		if (isValidUrl(value)) {
			createItem({
				type: "link",
				title: extractDomain(value),
				url: value,
				spaceId: defaultSpaceId,
				stayOnCurrentView: true,
			});
		} else {
			createItem({
				type: "thought",
				text: value,
				spaceId: defaultSpaceId,
				stayOnCurrentView: true,
			});
		}
		setText("");
	};

	return (
		<section className="flex h-full bg-base text-white">
			<div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-8">
				<div className="mx-auto max-w-[1280px]">
					<div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-serif font-medium text-3xl tracking-tight">
								<Icons.book className="size-7 text-brand-glow" />
								Library
							</h2>
							<p className="mt-2 max-w-2xl text-ink-3 text-sm">
								Capture ideas and links, then filter, order, and browse them your way.
							</p>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							<LibraryFilterMenu
								filter={filter}
								label={activeFilterLabel}
								onFilter={setFilter}
								items={libraryItems}
								spaces={spaces}
								tags={libraryTags}
							/>
							<GroupByMenu groupBy={prefs.groupBy} onGroupBy={setGroupBy} />
							<OrderByMenu
								label={activeOrderLabel}
								orderField={prefs.orderField}
								orderDir={prefs.orderDir}
								onOrderField={setOrderField}
								onToggleDir={toggleOrderDir}
							/>
							<Tabs value={prefs.viewMode} onValueChange={(value) => setViewMode(value as LibraryViewMode)}>
								<TabsList className="h-9 gap-1 rounded-[8px] border border-line-2 bg-sunken p-1">
									{VIEW_MODES.map((mode) => {
										const Icon = Icons[mode.icon];
										return (
											<TabsTrigger
												key={mode.id}
												value={mode.id}
												className="h-7 gap-1.5 rounded-[6px] px-2.5 font-medium text-ink-muted data-active:bg-brand-surface data-active:text-brand-soft"
											>
												<Icon className="size-3.5" />
												<span className="hidden sm:inline">{mode.label}</span>
											</TabsTrigger>
										);
									})}
								</TabsList>
							</Tabs>
						</div>
					</div>

					{filter.kind !== "all" ? (
						<div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
							<span className="text-ink-faint">Filtered by</span>
							<button
								type="button"
								onClick={() => setFilter({ kind: "all", value: "all" })}
								className="flex items-center gap-2 rounded-[999px] border border-line-soft bg-surface px-3 py-1.5 font-semibold text-ink-2 hover:border-line-strong"
							>
								{activeFilterLabel}
								<Icons.x className="size-3.5 text-ink-dim" />
							</button>
						</div>
					) : null}

					<div className="mt-6 flex gap-2 rounded-[12px] border border-line bg-panel p-2">
						<Input
							value={text}
							onChange={(event) => setText(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") addLibraryItem();
							}}
							placeholder="Capture an idea or paste a link..."
							className="h-10 border-0 bg-transparent text-ink placeholder:text-ink-faint focus-visible:ring-0"
						/>
						<Button
							type="button"
							onClick={addLibraryItem}
							className="h-10 rounded-[7px] bg-brand px-4 font-bold text-brand-ink hover:bg-brand-bright"
						>
							<Icons.plus className="size-4" />
							Add
						</Button>
					</div>

					<div className="mt-6 space-y-4">
						{visibleItems.length === 0 ? (
							<div className="rounded-[12px] border border-dashed border-raise px-6 py-14 text-center">
								<Icons.book className="mx-auto size-8 text-line-max" />
								<p className="mt-3 font-semibold text-ink-2">Nothing saved here yet</p>
							</div>
						) : (
							groupedItems.map((group) => (
								<LibraryGroup
									key={group.id}
									title={group.title}
									items={group.items}
									spaces={spaces}
									viewMode={prefs.viewMode}
									onOpen={openDetail}
								/>
							))
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

function LibraryFilterMenu({
	filter,
	label,
	onFilter,
	items,
	spaces,
	tags,
}: {
	filter: LibraryFilter;
	label: string;
	onFilter: (filter: LibraryFilter) => void;
	items: Item[];
	spaces: Space[];
	tags: string[];
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="h-9 gap-2 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 hover:text-white"
					/>
				}
			>
				<Icons.search className="size-4 text-brand" />
				<span className="max-w-[160px] truncate">{label}</span>
				<Icons.chevronRight className="size-4 rotate-90 text-ink-faint" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[280px] border border-line-2 bg-panel p-1 text-ink-2"
			>
				<DropdownMenuItem
					onClick={() => onFilter({ kind: "all", value: "all" })}
					className={cn("justify-between", filter.kind === "all" && "bg-fill text-white")}
				>
					<span className="flex items-center gap-2">
						<Icons.book className="size-4 text-brand" />
						All library
					</span>
					<CountBadge count={items.length} />
				</DropdownMenuItem>
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownLabel>Types</DropdownLabel>
				{LIBRARY_TYPES.map((type) => (
					<DropdownMenuItem
						key={type.id}
						onClick={() => onFilter({ kind: "type", value: type.id })}
						className={cn(
							"justify-between",
							filter.kind === "type" && filter.value === type.id && "bg-fill text-white",
						)}
					>
						<span className="flex items-center gap-2">
							{type.id === "link" ? <Icons.link className="size-4" /> : <Icons.sparkles className="size-4" />}
							{type.label}
						</span>
						<CountBadge count={items.filter((item) => item.type === type.id).length} />
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownLabel>Groups</DropdownLabel>
				{spaces.map((space) => (
					<DropdownMenuItem
						key={space.id}
						onClick={() => onFilter({ kind: "group", value: space.id })}
						className={cn(
							"justify-between",
							filter.kind === "group" && filter.value === space.id && "bg-fill text-white",
						)}
					>
						<span className="truncate">{space.name}</span>
						<CountBadge count={items.filter((item) => item.spaceId === space.id).length} />
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator className="my-1 bg-line" />
				<DropdownLabel>Tags</DropdownLabel>
				{tags.length === 0 ? (
					<div className="px-2 py-2 text-ink-ghost text-xs">No library tags yet</div>
				) : (
					tags.map((tag) => (
						<DropdownMenuItem
							key={tag}
							onClick={() => onFilter({ kind: "tag", value: tag })}
							className={cn(
								"justify-between",
								filter.kind === "tag" && filter.value === tag && "bg-fill text-white",
							)}
						>
							<span className="truncate">#{tag}</span>
							<CountBadge count={items.filter((item) => item.tags?.includes(tag)).length} />
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function GroupByMenu({
	groupBy,
	onGroupBy,
}: {
	groupBy: LibraryGroupBy;
	onGroupBy: (groupBy: LibraryGroupBy) => void;
}) {
	const label = GROUP_BY_OPTIONS.find((o) => o.id === groupBy)?.label ?? "None";
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						className="h-9 gap-2 rounded-[8px] border border-line-2 bg-sunken px-3 text-ink-2 hover:text-white"
					/>
				}
			>
				<Icons.layout className="size-4 text-brand" />
				<span className="text-ink-dim">Group</span>
				<span className="font-semibold">{label}</span>
				<Icons.chevronRight className="size-4 rotate-90 text-ink-faint" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[200px] border border-line-2 bg-panel p-1 text-ink-2">
				{GROUP_BY_OPTIONS.map((option) => (
					<DropdownMenuItem
						key={option.id}
						onClick={() => onGroupBy(option.id)}
						className={cn("justify-between", groupBy === option.id && "bg-fill text-white")}
					>
						{option.label}
						{groupBy === option.id ? <Icons.check className="size-4 text-brand" /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OrderByMenu({
	label,
	orderField,
	orderDir,
	onOrderField,
	onToggleDir,
}: {
	label: string;
	orderField: LibraryOrderField;
	orderDir: LibraryOrderDir;
	onOrderField: (field: LibraryOrderField) => void;
	onToggleDir: () => void;
}) {
	return (
		<div className="inline-flex items-center rounded-[8px] border border-line-2 bg-sunken">
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							className="h-9 gap-2 rounded-[8px] rounded-r-none px-3 text-ink-2 hover:text-white"
						/>
					}
				>
					<Icons.clock className="size-4 text-brand" />
					<span className="text-ink-dim">Sort</span>
					<span className="font-semibold">{label}</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-[200px] border border-line-2 bg-panel p-1 text-ink-2">
					{ORDER_FIELDS.map((option) => (
						<DropdownMenuItem
							key={option.id}
							onClick={() => onOrderField(option.id)}
							className={cn("justify-between", orderField === option.id && "bg-fill text-white")}
						>
							{option.label}
							{orderField === option.id ? <Icons.check className="size-4 text-brand" /> : null}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<button
				type="button"
				onClick={onToggleDir}
				aria-label={orderDir === "asc" ? "Sort ascending" : "Sort descending"}
				className="grid h-9 w-8 place-items-center border-line-2 border-l text-ink-muted hover:text-white"
			>
				<Icons.chevronRight
					className={cn("size-4 transition-transform", orderDir === "asc" ? "-rotate-90" : "rotate-90")}
				/>
			</button>
		</div>
	);
}

function CountBadge({ count }: { count: number }) {
	return (
		<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-ink-dim text-[11px]">
			{count}
		</span>
	);
}

function DropdownLabel({ children }: { children: React.ReactNode }) {
	return <div className="px-2 py-2 text-ink-faint text-xs">{children}</div>;
}

function buildLibraryGroups(items: Item[], groupBy: LibraryGroupBy, spaces: Space[]) {
	if (groupBy === "none") {
		return items.length ? [{ id: "all", title: "", items }] : [];
	}
	if (groupBy === "type") {
		const groups = new Map<LibraryType, Item[]>();
		for (const type of LIBRARY_TYPES) groups.set(type.id, []);
		for (const item of items) {
			if (item.type === "thought" || item.type === "link") groups.get(item.type)?.push(item);
		}
		return LIBRARY_TYPES.flatMap((type) => {
			const groupItems = groups.get(type.id) ?? [];
			return groupItems.length ? [{ id: type.id, title: type.label, items: groupItems }] : [];
		});
	}
	if (groupBy === "group") {
		const groups = new Map<string, Item[]>();
		for (const space of spaces) groups.set(space.id, []);
		for (const item of items) groups.get(item.spaceId)?.push(item);
		return spaces.flatMap((space) => {
			const groupItems = groups.get(space.id) ?? [];
			return groupItems.length ? [{ id: space.id, title: space.name, items: groupItems }] : [];
		});
	}
	const groups = new Map<string, Item[]>();
	for (const item of items) {
		const itemTags = item.tags?.length ? item.tags : ["untagged"];
		for (const tag of itemTags) {
			if (!groups.has(tag)) groups.set(tag, []);
			groups.get(tag)?.push(item);
		}
	}
	return [...groups.entries()]
		.toSorted(([a], [b]) => a.localeCompare(b))
		.map(([tag, groupItems]) => ({
			id: tag,
			title: tag === "untagged" ? "Untagged" : `#${tag}`,
			items: groupItems,
		}));
}

function LibraryGroup({
	title,
	items,
	spaces,
	viewMode,
	onOpen,
}: {
	title: string;
	items: Item[];
	spaces: Space[];
	viewMode: LibraryViewMode;
	onOpen: (id: string) => void;
}) {
	const body = (
		<>
			{viewMode === "list" ? (
				<div className="divide-y divide-fill">
					{items.map((item) => (
						<LibraryListRow
							key={item.id}
							item={item}
							groupName={spaceName(spaces, item.spaceId)}
							onOpen={() => onOpen(item.id)}
						/>
					))}
				</div>
			) : viewMode === "moodboard" ? (
				<div className="columns-1 gap-3 p-3 sm:columns-2 lg:columns-3 [&>*]:mb-3">
					{items.map((item) => (
						<LibraryCard
							key={item.id}
							item={item}
							groupName={spaceName(spaces, item.spaceId)}
							onOpen={() => onOpen(item.id)}
							masonry
						/>
					))}
				</div>
			) : (
				<div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((item) => (
						<LibraryCard
							key={item.id}
							item={item}
							groupName={spaceName(spaces, item.spaceId)}
							onOpen={() => onOpen(item.id)}
						/>
					))}
				</div>
			)}
		</>
	);

	if (!title) {
		return (
			<div className="overflow-hidden rounded-[12px] border border-fill bg-panel">
				{viewMode === "list" ? <div className="px-1">{body}</div> : body}
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded-[12px] border border-fill bg-panel">
			<div className="flex items-center justify-between border-fill border-b px-4 py-3">
				<h3 className="font-bold text-ink">{title}</h3>
				<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-ink-dim text-[11px]">
					{items.length}
				</span>
			</div>
			{viewMode === "list" ? <div className="px-1">{body}</div> : body}
		</div>
	);
}

/** Favicon thumbnail for a link, with a graceful icon fallback if it fails to load. */
function LinkFavicon({ url, className }: { url: string; className?: string }) {
	const [failed, setFailed] = useState(false);
	const src = faviconUrl(url);
	if (failed || !src) return <Icons.link className={cn("text-blue", className)} />;
	return (
		// biome-ignore lint/performance/noImgElement: tiny third-party favicons, not worth next/image
		<img
			src={src}
			alt=""
			loading="lazy"
			onError={() => setFailed(true)}
			className={cn("object-contain", className)}
		/>
	);
}

function LibraryListRow({
	item,
	groupName,
	onOpen,
}: {
	item: Item;
	groupName: string;
	onOpen: () => void;
}) {
	const body = itemBody(item);
	return (
		<button
			type="button"
			onClick={onOpen}
			className="flex w-full items-start gap-4 px-3 py-3.5 text-left transition-colors hover:bg-surface"
		>
			<span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-fill">
				{item.type === "link" ? (
					<LinkFavicon url={item.url ?? ""} className="size-4" />
				) : (
					<Icons.sparkles className="size-4 text-brand" />
				)}
			</span>
			<div className="min-w-0 flex-1">
				<h4 className="truncate font-bold text-ink">{itemTitle(item)}</h4>
				{body ? (
					<p className="mt-1 line-clamp-2 break-words text-ink-muted text-sm leading-5">{body}</p>
				) : null}
				<div className="mt-2 flex flex-wrap items-center gap-1.5">
					<span className="rounded-[5px] bg-fill px-1.5 py-0.5 text-ink-dim text-[11px]">{groupName}</span>
					{item.tags?.map((tag) => (
						<span key={tag} className="rounded-[5px] bg-brand-surface px-1.5 py-0.5 text-brand-soft text-[11px]">
							#{tag}
						</span>
					))}
				</div>
			</div>
		</button>
	);
}

function LibraryCard({
	item,
	groupName,
	onOpen,
	masonry,
}: {
	item: Item;
	groupName: string;
	onOpen: () => void;
	masonry?: boolean;
}) {
	const body = itemBody(item);
	const isLink = item.type === "link" && item.url;
	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"block w-full min-w-0 break-inside-avoid overflow-hidden rounded-[8px] border border-line bg-base text-left transition-colors hover:border-line-strong hover:bg-surface",
				masonry && "align-top",
			)}
		>
			{isLink ? (
				<div className="flex items-center gap-2.5 border-line border-b bg-fill/50 px-4 py-3">
					<span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-base">
						<LinkFavicon url={item.url ?? ""} className="size-4" />
					</span>
					<span className="min-w-0 flex-1 truncate font-medium text-ink-2 text-xs">
						{extractDomain(item.url ?? "")}
					</span>
					<Icons.link className="size-3.5 shrink-0 text-ink-dim" />
				</div>
			) : null}
			<div className={cn("p-4", isLink && "pt-3.5")}>
			<div className="mb-3 flex items-center gap-2">
				{item.type === "link" ? (
					<Icons.link className="size-4 text-blue" />
				) : (
					<Icons.sparkles className="size-4 text-brand" />
				)}
				<span className="rounded-[5px] bg-fill px-1.5 py-0.5 text-ink-dim text-[11px]">
					{groupName}
				</span>
			</div>
			<h4 className={cn("font-bold text-ink", masonry ? "" : "line-clamp-2")}>{itemTitle(item)}</h4>
			{body ? (
				<p
					className={cn(
						"mt-2 break-words text-ink-muted text-sm leading-5",
						masonry ? "" : "line-clamp-3",
					)}
				>
					{body}
				</p>
			) : null}
			{item.tags?.length ? (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{item.tags.map((tag) => (
						<span key={tag} className="rounded-[5px] bg-brand-surface px-1.5 py-0.5 text-brand-soft text-[11px]">
							#{tag}
						</span>
					))}
				</div>
			) : null}
			</div>
		</button>
	);
}
