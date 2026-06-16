"use client";

import { Button } from "@alphonse/ui/components/button";
import { Input } from "@alphonse/ui/components/input";
import { Tabs, TabsList, TabsTrigger } from "@alphonse/ui/components/tabs";
import { cn } from "@alphonse/ui/lib/utils";
import { useMemo, useState } from "react";

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

	const visibleItems = useMemo(() => {
		switch (filter.kind) {
			case "type":
				return libraryItems.filter((item) => item.type === filter.value);
			case "group":
				return libraryItems.filter((item) => item.spaceId === filter.value);
			case "tag":
				return libraryItems.filter((item) => item.tags?.includes(filter.value));
			default:
				return libraryItems;
		}
	}, [filter, libraryItems]);

	const groupedItems = useMemo(
		() => buildLibraryGroups(visibleItems, groupBy, spaces),
		[visibleItems, groupBy, spaces],
	);

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
		<section className="flex h-full bg-[#151310] text-white">
			<LibrarySecondSidebar
				filter={filter}
				onFilter={setFilter}
				items={libraryItems}
				spaces={spaces}
				tags={libraryTags}
			/>

			<div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
				<div className="mx-auto max-w-[920px]">
					<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<h2 className="flex items-center gap-3 font-bold text-3xl">
								<Icons.book className="size-7 text-[#9b88ff]" />
								Library
							</h2>
							<p className="mt-2 max-w-2xl text-[#a99f93] text-sm">
								Capture ideas and links, then filter them by type, group, or tag.
							</p>
						</div>

						<Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as LibraryGroupBy)}>
							<TabsList className="rounded-[8px] bg-[#23201d] p-1">
								{(["type", "group", "tag"] as LibraryGroupBy[]).map((value) => (
									<TabsTrigger
										key={value}
										value={value}
										className="h-8 rounded-[6px] px-3 capitalize text-[#948c82] data-active:bg-[#312d28] data-active:text-white"
									>
										{value}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

					<div className="mt-7 flex gap-2 rounded-[9px] border border-[#2a2621] bg-[#1b1815] p-2">
						<Input
							value={text}
							onChange={(event) => setText(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") addLibraryItem();
							}}
							placeholder="Capture an idea or paste a link..."
							className="h-10 border-0 bg-transparent text-[#f0ebe3] placeholder:text-[#6b6460] focus-visible:ring-0"
						/>
						<Button
							type="button"
							onClick={addLibraryItem}
							className="h-10 rounded-[7px] bg-[#907ce8] px-4 font-bold text-[#17131f] hover:bg-[#a08ef2]"
						>
							<Icons.plus className="size-4" />
							Add
						</Button>
					</div>

					<div className="mt-7 space-y-4">
						{visibleItems.length === 0 ? (
							<div className="rounded-[9px] border border-dashed border-[#34302b] px-6 py-14 text-center">
								<Icons.book className="mx-auto size-8 text-[#4c463e]" />
								<p className="mt-3 font-semibold text-[#c8bfb2]">Nothing saved here yet</p>
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

function LibrarySecondSidebar({
	filter,
	onFilter,
	items,
	spaces,
	tags,
}: {
	filter: LibraryFilter;
	onFilter: (filter: LibraryFilter) => void;
	items: Item[];
	spaces: Space[];
	tags: string[];
}) {
	return (
		<aside className="hidden w-[248px] shrink-0 overflow-y-auto border-[#292622] border-r bg-[#100f0d] px-3 py-5 lg:block">
			<SidebarButton
				active={filter.kind === "all"}
				label="All library"
				count={items.length}
				icon={<Icons.book className="size-4" />}
				onClick={() => onFilter({ kind: "all", value: "all" })}
			/>

			<SidebarSection title="Types">
				{LIBRARY_TYPES.map((type) => (
					<SidebarButton
						key={type.id}
						active={filter.kind === "type" && filter.value === type.id}
						label={type.label}
						count={items.filter((item) => item.type === type.id).length}
						icon={type.id === "link" ? <Icons.link className="size-4" /> : <Icons.sparkles className="size-4" />}
						onClick={() => onFilter({ kind: "type", value: type.id })}
					/>
				))}
			</SidebarSection>

			<SidebarSection title="Groups">
				{spaces.map((space) => (
					<SidebarButton
						key={space.id}
						active={filter.kind === "group" && filter.value === space.id}
						label={space.name}
						count={items.filter((item) => item.spaceId === space.id).length}
						icon={<Icons.book className="size-4" />}
						onClick={() => onFilter({ kind: "group", value: space.id })}
					/>
				))}
			</SidebarSection>

			<SidebarSection title="Tags">
				{tags.length === 0 ? (
					<p className="px-3 py-2 text-[#5f574f] text-xs">No library tags yet</p>
				) : (
					tags.map((tag) => (
						<SidebarButton
							key={tag}
							active={filter.kind === "tag" && filter.value === tag}
							label={`#${tag}`}
							count={items.filter((item) => item.tags?.includes(tag)).length}
							icon={<Icons.flag className="size-4" />}
							onClick={() => onFilter({ kind: "tag", value: tag })}
						/>
					))
				)}
			</SidebarSection>
		</aside>
	);
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-6">
			<p className="mb-2 px-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.14em]">
				{title}
			</p>
			<div className="space-y-1">{children}</div>
		</div>
	);
}

function SidebarButton({
	active,
	label,
	count,
	icon,
	onClick,
}: {
	active: boolean;
	label: string;
	count: number;
	icon: React.ReactNode;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex w-full items-center gap-3 rounded-[7px] px-3 py-2 text-left text-sm transition-colors",
				active ? "bg-[#22201f] text-white" : "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
			)}
		>
			<span className="text-[#907ce8]">{icon}</span>
			<span className="min-w-0 flex-1 truncate font-semibold">{label}</span>
			<span className="rounded-[5px] bg-[#252220] px-1.5 py-0.5 font-mono text-[#82786e] text-[11px]">
				{count}
			</span>
		</button>
	);
}

function buildLibraryGroups(items: Item[], groupBy: LibraryGroupBy, spaces: Space[]) {
	if (groupBy === "type") {
		return LIBRARY_TYPES.map((type) => ({
			id: type.id,
			title: type.label,
			items: items.filter((item) => item.type === type.id),
		})).filter((group) => group.items.length > 0);
	}
	if (groupBy === "group") {
		return spaces
			.map((space) => ({
				id: space.id,
				title: space.name,
				items: items.filter((item) => item.spaceId === space.id),
			}))
			.filter((group) => group.items.length > 0);
	}
	const tags = [...new Set(items.flatMap((item) => item.tags?.length ? item.tags : ["untagged"]))].sort();
	return tags.map((tag) => ({
		id: tag,
		title: tag === "untagged" ? "Untagged" : `#${tag}`,
		items: items.filter((item) => (item.tags?.length ? item.tags : ["untagged"]).includes(tag)),
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
		<div className="overflow-hidden rounded-[9px] border border-[#26221e] bg-[#1b1815]">
			<div className="flex items-center justify-between border-[#26221e] border-b px-4 py-3">
				<h3 className="font-bold text-[#efe9df]">{title}</h3>
				<span className="rounded-[5px] bg-[#252220] px-1.5 py-0.5 font-mono text-[#82786e] text-[11px]">
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
			className="min-w-0 rounded-[8px] border border-[#2a2621] bg-[#181511] p-4 text-left transition-colors hover:border-[#3a3530] hover:bg-[#1f1c17]"
		>
			<div className="mb-3 flex items-center gap-2">
				{item.type === "link" ? (
					<Icons.link className="size-4 text-[#4aa5c8]" />
				) : (
					<Icons.sparkles className="size-4 text-[#907ce8]" />
				)}
				<span className="rounded-[5px] bg-[#252220] px-1.5 py-0.5 text-[#82786e] text-[11px]">
					{groupName}
				</span>
			</div>
			<h4 className="line-clamp-2 font-bold text-[#f0ebe3]">{itemTitle(item)}</h4>
			{body ? (
				<p className="mt-2 line-clamp-3 break-words text-[#9f9588] text-sm leading-5">{body}</p>
			) : null}
			{item.tags?.length ? (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{item.tags.map((tag) => (
						<span key={tag} className="rounded-[5px] bg-[#242036] px-1.5 py-0.5 text-[#c7bcff] text-[11px]">
							#{tag}
						</span>
					))}
				</div>
			) : null}
		</button>
	);
}
