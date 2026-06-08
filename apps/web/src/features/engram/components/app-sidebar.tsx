"use client";

import { Button, buttonVariants } from "@alphonse/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@alphonse/ui/components/dropdown-menu";
import { cn } from "@alphonse/ui/lib/utils";
import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { NAV_VIEWS, SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Space } from "../types";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const ACCENT_COLOR_MAP: Record<string, string> = {
	violet: "text-[#907ce8]",
	gold: "text-[#d9a82f]",
	teal: "text-[#43b6a6]",
	red: "text-[#e46f50]",
	blue: "text-[#4aa5c8]",
};

const navItemClass = "h-[36px] w-full justify-between rounded-[7px] px-3 py-2 text-sm font-normal";

function SortableSpaceItem({
	space,
	isActive,
	onActivate,
	onEdit,
	onDelete,
}: {
	space: Space;
	isActive: boolean;
	onActivate: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: space.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const iconKey = (space.icon in SPACE_ICONS ? space.icon : "sparkles") as SpaceIconKey;
	const Icon = Icons[SPACE_ICONS[iconKey]];
	const colorClass = ACCENT_COLOR_MAP[space.color ?? "violet"] ?? "text-[#b7afa5]";

	return (
		<div ref={setNodeRef} style={style} className="group/space-item relative">
			<div
				{...attributes}
				{...listeners}
				className={cn(
					"flex h-[36px] w-full items-center gap-3 rounded-[7px] px-3 py-2 text-sm font-normal",
					"transition-[background-color,color,transform] duration-150",
					"active:scale-[0.98] motion-reduce:active:scale-100",
					isDragging && "opacity-50",
					isActive
						? "bg-[#22201f] font-semibold text-white"
						: "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
				)}
				onClick={onActivate}
			>
				<Icon className={cn("size-4 shrink-0", isActive ? colorClass : "")} />
				<span className="truncate flex-1">{space.name}</span>
			</div>
			{/* Context menu button — visible on hover */}
			<DropdownMenu>
				<DropdownMenuTrigger
					className={cn(
						"absolute right-1 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-[5px]",
						"opacity-0 group-hover/space-item:opacity-100 focus:opacity-100",
						"text-[#706a62] hover:bg-[#22201f] hover:text-[#c8bfb2]",
						"transition-[opacity,background-color,color,transform] duration-150",
						"active:scale-[0.95] motion-reduce:active:scale-100",
					)}
				>
					<Icons.moreHorizontal className="size-3.5" />
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="right"
					align="start"
					sideOffset={4}
					className="rounded-[10px] border-[#2e2b26] bg-[#1a1714] text-[#efe9df] min-w-[140px]"
				>
					<DropdownMenuItem
						onClick={onEdit}
						className="text-[#b0a99f] focus:bg-[#22201f] focus:text-white cursor-pointer"
					>
						<Icons.pencil className="size-4 mr-1.5" />
						Edit space
					</DropdownMenuItem>
					<DropdownMenuSeparator className="bg-[#2e2b26]" />
					<DropdownMenuItem
						variant="destructive"
						onClick={onDelete}
						className="cursor-pointer"
					>
						<Icons.trash className="size-4 mr-1.5" />
						Delete space
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export function AppSidebar() {
	const pathname = usePathname();
	const { spaces, activeSpaceId, setActiveSpace, updateSpace, inboxItems } = useEngramStore();
	const { sidebarCollapsed, toggleSidebar, openNewSpaceDialog, openEditSpaceDialog, openDeleteSpaceDialog } = useUIStore();

	const [activeId, setActiveId] = useState<string | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleDragStart = ({ active }: DragStartEvent) => {
		setActiveId(active.id as string);
	};

	const handleDragEnd = ({ active, over }: DragEndEvent) => {
		setActiveId(null);
		if (!over || active.id === over.id) return;

		const oldIndex = spaces.findIndex((s) => s.id === active.id);
		const newIndex = spaces.findIndex((s) => s.id === over.id);
		if (oldIndex === -1 || newIndex === -1) return;

		const reordered = arrayMove(spaces, oldIndex, newIndex);
		reordered.forEach((s, i) => {
			if (s.sortOrder !== i) {
				updateSpace(s.id, { sortOrder: i });
			}
		});
	};

	const sortedSpaces = [...spaces].sort((a, b) => a.sortOrder - b.sortOrder);

	return (
		<aside
			className={cn(
				"hidden shrink-0 border-[#292622] border-r bg-[#0b0b0a] text-[#c7bfb4] md:flex md:flex-col",
				"overflow-hidden transition-[width] duration-200",
				sidebarCollapsed ? "w-0 border-r-0" : "w-[252px]",
			)}
		>
			<div className="flex h-16 w-[252px] items-center justify-between px-5">
				<div className="flex items-center gap-3 font-bold text-lg text-white">
					<img
						src="/favicon.ico"
						alt=""
						aria-hidden="true"
						className="size-7 shrink-0 rounded-[6px]"
					/>
					Engram
				</div>
				<Button
					variant="ghost"
					size="icon-xs"
					className="text-[#706a62] hover:text-[#c8bfb2]"
					onClick={toggleSidebar}
					title="Toggle sidebar  ["
				>
					<Icons.chevronLeft className="size-4" />
				</Button>
			</div>

			<nav className="space-y-1 px-3">
				{NAV_VIEWS.map(({ href, label, icon }) => {
					const Icon = Icons[icon];
					const active = pathname === href;
					return (
						<Link
							key={href}
							href={href as Route<string>}
							className={cn(
								buttonVariants({ variant: "ghost" }),
								navItemClass,
								active
									? "bg-[#22201f] text-white"
									: "text-[#b7afa5] hover:bg-[#171614] hover:text-white",
							)}
						>
							<span className="flex items-center gap-3">
								<Icon className={cn("size-4", active && "text-[#9b88ff]")} />
								<span className="font-semibold">{label}</span>
									{href === "/inbox" && inboxItems.length > 0 && (
										<span className="ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#3a3252] px-1.5 font-mono text-[11px] font-semibold text-[#cfc7ff]">
											{inboxItems.length}
										</span>
									)}
							</span>
						</Link>
					);
				})}
			</nav>

			<div className="mt-8 px-3">
				<p className="mb-2 px-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.14em]">
					Spaces
				</p>
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragStart={handleDragStart}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sortedSpaces.map((s) => s.id)}
						strategy={verticalListSortingStrategy}
					>
						<div className="space-y-1">
							{sortedSpaces.map((space) => (
								<SortableSpaceItem
									key={space.id}
									space={space}
									isActive={activeSpaceId === space.id}
									onActivate={() => setActiveSpace(space.id)}
									onEdit={() => openEditSpaceDialog(space.id)}
									onDelete={() => openDeleteSpaceDialog(space.id)}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
				<Button
					type="button"
					variant="ghost"
					onClick={openNewSpaceDialog}
					className={cn(
						"h-[36px] w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-[#8c857b] text-sm font-normal",
						"transition-[background-color,color,transform] duration-150",
						"active:scale-[0.98] motion-reduce:active:scale-100",
					)}
				>
					<Icons.plus className="size-4" />
					New space
				</Button>
			</div>

			<div className="mt-auto flex items-center justify-between px-5 py-5 text-[#7f776d]">
				<Icons.rotate className="size-4" />
				<Icons.settings className="size-4" />
				<Icons.info className="size-4" />
			</div>
		</aside>
	);
}
