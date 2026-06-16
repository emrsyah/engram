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
import { Icons } from "./icons";

type LibraryFilter =
	| { kind: "all"; value: "all" }
	| { kind: "type"; value: LibraryType }
	| { kind: "group"; value: string }
	| { kind: "tag"; value: string };

type LibraryGroupBy = "type" | "group" | "tag";

const LIBRARY_TYPES: { id: LibraryType; label: string }[] = [
	{ id: "thought", label: "Ideas" },
	{ id: "link", label: "Links" },
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

export function LibraryView() {
	const { allTags, createItem, libraryItems, spaces } = useEngramStore();
	const { openDetail } = useUIStore();
	const [filter, setFilter] = useState<LibraryFilter>({ kind: "all", value: "all" });
	const [groupBy, setGroupBy] = useState<LibraryGroupBy>("type");
	const [text, setText] = useState("");

	const defaultSpaceId = spaces[0]?.id;
	const libraryTags = allTags.filter((tag) => libraryItems.some((item) => item.tags?.includes(tag)));

	const visibleItems =
		filter.kind === "type"
			? libraryItems.filter((item) => item.type === filter.value)
			: filter.kind === "group"
				? libraryItems.filter((item) => item.spaceId === filter.value)
				: filter.kind === "tag"
					? libraryItems.filter((item) => item.tags?.includes(filter.value))
					: libraryItems;
	const groupedItems = buildLibraryGroups(visibleItems, groupBy, spaces);
	const activeFilterLabel =
		filter.kind === "type"
			? (LIBRARY_TYPES.find((type) => type.id === filter.value)?.label ?? "Type")
			: filter.kind === "group"
				? spaceName(spaces, filter.value)
				: filter.kind === "tag"
					? `#${filter.value}`
					: "All library";

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
			<div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
				<div className="mx-auto max-w-[920px]">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-bold text-3xl">
								<Icons.book className="size-7 text-brand-glow" />
								Library
							</h2>
							<p className="mt-2 max-w-2xl text-ink-3 text-sm">
								Capture ideas and links, then filter them by type, group, or tag.
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
							<Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as LibraryGroupBy)}>
								<TabsList className="rounded-[8px] bg-fill p-1">
									{(["type", "group", "tag"] as LibraryGroupBy[]).map((value) => (
										<TabsTrigger
											key={value}
											value={value}
											className="h-8 rounded-[6px] px-3 capitalize text-ink-muted data-active:bg-raise data-active:text-white"
										>
											{value}
										</TabsTrigger>
									))}
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

					<div className="mt-7 flex gap-2 rounded-[9px] border border-line bg-panel p-2">
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

					<div className="mt-7 space-y-4">
						{visibleItems.length === 0 ? (
							<div className="rounded-[9px] border border-dashed border-raise px-6 py-14 text-center">
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
						className="h-9 rounded-[7px] border border-line bg-panel px-3 text-ink-2 hover:text-white"
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
	onOpen,
}: {
	title: string;
	items: Item[];
	spaces: Space[];
	onOpen: (id: string) => void;
}) {
	return (
		<div className="overflow-hidden rounded-[9px] border border-fill bg-panel">
			<div className="flex items-center justify-between border-fill border-b px-4 py-3">
				<h3 className="font-bold text-ink">{title}</h3>
				<span className="rounded-[5px] bg-fill px-1.5 py-0.5 font-mono text-ink-dim text-[11px]">
					{items.length}
				</span>
			</div>
			<div className="grid gap-3 p-3 md:grid-cols-2">
				{items.map((item) => (
					<LibraryCard
						key={item.id}
						item={item}
						groupName={spaceName(spaces, item.spaceId)}
						onOpen={() => onOpen(item.id)}
					/>
				))}
			</div>
		</div>
	);
}

function LibraryCard({ item, groupName, onOpen }: { item: Item; groupName: string; onOpen: () => void }) {
	const body = itemBody(item);
	return (
		<button
			type="button"
			onClick={onOpen}
			className="min-w-0 rounded-[8px] border border-line bg-base p-4 text-left transition-colors hover:border-line-strong hover:bg-surface"
		>
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
			<h4 className="line-clamp-2 font-bold text-ink">{itemTitle(item)}</h4>
			{body ? (
				<p className="mt-2 line-clamp-3 break-words text-ink-muted text-sm leading-5">{body}</p>
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
		</button>
	);
}
