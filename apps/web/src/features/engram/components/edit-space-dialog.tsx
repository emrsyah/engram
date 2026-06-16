"use client";

import { Button } from "@alphonse/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@alphonse/ui/components/dialog";
import { Input } from "@alphonse/ui/components/input";
import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

import type { UpdateSpaceInput } from "../engram-core";
import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Accent, Space } from "../types";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const ICON_KEYS = Object.keys(SPACE_ICONS) as SpaceIconKey[];
const ICON_COLS = 6;

const ACCENT_OPTIONS: {
	value: Accent;
	label: string;
	bg: string;
	ring: string;
	text: string;
	dot: string;
}[] = [
	{ value: "violet", label: "Violet", bg: "bg-brand-surface", ring: "ring-brand/50", text: "text-brand-soft", dot: "bg-brand" },
	{ value: "gold", label: "Gold", bg: "bg-fill", ring: "ring-honey/50", text: "text-p2-ink", dot: "bg-honey" },
	{ value: "teal", label: "Teal", bg: "bg-fill", ring: "ring-teal/50", text: "text-p3-ink", dot: "bg-teal" },
	{ value: "red", label: "Red", bg: "bg-surface", ring: "ring-coral/50", text: "text-p1-ink", dot: "bg-coral" },
	{ value: "blue", label: "Blue", bg: "bg-brand-surface", ring: "ring-blue/50", text: "text-p3-ink", dot: "bg-blue" },
];

type Section = "name" | "icon" | "color";

export function EditSpaceDialog() {
	const { editingSpaceId, closeEditSpaceDialog } = useUIStore();
	const { spaces, updateSpace } = useEngramStore();

	const space = spaces.find((s) => s.id === editingSpaceId);
	const isOpen = !!editingSpaceId;

	if (!space) return null;

	return (
		<EditSpaceDialogContent
			key={space.id}
			space={space}
			isOpen={isOpen}
			closeEditSpaceDialog={closeEditSpaceDialog}
			updateSpace={updateSpace}
		/>
	);
}

function EditSpaceDialogContent({
	space,
	isOpen,
	closeEditSpaceDialog,
	updateSpace,
}: {
	space: Space;
	isOpen: boolean;
	closeEditSpaceDialog: () => void;
	updateSpace: (id: string, patch: UpdateSpaceInput) => void;
}) {
	const [name, setName] = useState(() => space.name);
	const [icon, setIcon] = useState<SpaceIconKey>(() => (space.icon in SPACE_ICONS ? space.icon : "sparkles") as SpaceIconKey);
	const [color, setColor] = useState<Accent>(() => space.color ?? "violet");
	const [section, setSection] = useState<Section>("name");

	const inputRef = useRef<HTMLInputElement>(null);
	const iconRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const colorRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const canSave = name.trim().length > 0;

	const handleSave = useCallback(() => {
		if (!canSave) return;
		updateSpace(space.id, {
			name: name.trim(),
			icon,
			color,
		});
		closeEditSpaceDialog();
	}, [canSave, space.id, name, icon, color, updateSpace, closeEditSpaceDialog]);

	// Auto-focus name input when dialog opens
	useEffect(() => {
		if (isOpen) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isOpen]);

	// Global Ctrl/Cmd+Enter shortcut while dialog is open
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSave) {
				e.preventDefault();
				handleSave();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, canSave, handleSave]);

	const handleOpenChange = (open: boolean) => {
		if (!open) closeEditSpaceDialog();
	};

	// ── Icon grid keyboard navigation ──
	const handleIconKeyDown = useCallback(
		(e: React.KeyboardEvent, key: SpaceIconKey) => {
			const idx = ICON_KEYS.indexOf(key);
			let nextIdx = idx;

			if (e.key === "ArrowRight") nextIdx = Math.min(idx + 1, ICON_KEYS.length - 1);
			else if (e.key === "ArrowLeft") nextIdx = Math.max(idx - 1, 0);
			else if (e.key === "ArrowDown") nextIdx = Math.min(idx + ICON_COLS, ICON_KEYS.length - 1);
			else if (e.key === "ArrowUp") nextIdx = Math.max(idx - ICON_COLS, 0);
			else if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); setSection("color"); return; }
			else if (e.key === "Tab" && e.shiftKey) { e.preventDefault(); setSection("name"); return; }
			else return;

			e.preventDefault();
			const nextKey = ICON_KEYS[nextIdx];
			setIcon(nextKey);
			iconRefs.current.get(nextKey)?.focus();
		},
		[],
	);

	// ── Color row keyboard navigation ──
	const handleColorKeyDown = useCallback(
		(e: React.KeyboardEvent, value: Accent) => {
			const idx = ACCENT_OPTIONS.findIndex((a) => a.value === value);

			if (e.key === "ArrowRight") {
				e.preventDefault();
				const next = ACCENT_OPTIONS[Math.min(idx + 1, ACCENT_OPTIONS.length - 1)];
				setColor(next.value);
				colorRefs.current.get(next.value)?.focus();
			} else if (e.key === "ArrowLeft") {
				e.preventDefault();
				const prev = ACCENT_OPTIONS[Math.max(idx - 1, 0)];
				setColor(prev.value);
				colorRefs.current.get(prev.value)?.focus();
			} else if (e.key === "Tab" && e.shiftKey) {
				e.preventDefault();
				setSection("icon");
			}
		},
		[],
	);

	// ── Name input keyboard ──
	const handleNameKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && canSave)) {
				handleSave();
			} else if (e.key === "Tab" && !e.shiftKey) {
				e.preventDefault();
				setSection("icon");
			}
		},
		[canSave, handleSave],
	);

	// Focus the active section when it changes
	useEffect(() => {
		if (!isOpen) return;
		requestAnimationFrame(() => {
			if (section === "name") inputRef.current?.focus();
			else if (section === "icon") iconRefs.current.get(icon)?.focus();
			else if (section === "color") colorRefs.current.get(color)?.focus();
		});
	}, [section, isOpen, icon, color]);

	const selectedAccent = ACCENT_OPTIONS.find((a) => a.value === color)!;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="rounded-[12px] border-line-soft bg-panel sm:max-w-[420px] p-0 gap-0 overflow-hidden"
			>
				<DialogHeader className="border-line-soft border-b px-5 py-4">
					<DialogTitle className="font-bold text-white text-base">
						Edit space
					</DialogTitle>
					<DialogDescription className="text-ink-muted text-sm">
						Update the name, icon, and color of this space.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 px-5 py-5">
					{/* ── Name ── */}
					<div className="space-y-2">
						<label className="font-bold text-ink-3 text-[11px] uppercase tracking-widest">
							Name
						</label>
						<Input
							ref={inputRef}
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleNameKeyDown}
							placeholder="e.g. Side project, Health, Travel…"
							className="h-10 rounded-[8px] border-raise bg-surface px-3 text-[15px] text-ink placeholder:text-ink-ghost focus:border-line-max focus-visible:ring-0"
						/>
					</div>

					{/* ── Icon ── */}
					<div className="space-y-2">
						<label className="font-bold text-ink-3 text-[11px] uppercase tracking-widest">
							Icon
						</label>
						<div className="grid grid-cols-6 gap-1.5" role="listbox" aria-label="Space icon">
							{ICON_KEYS.map((key) => {
								const Icon = Icons[SPACE_ICONS[key]];
								const isSelected = icon === key;
								return (
									<button
										key={key}
										type="button"
										ref={(el) => { if (el) iconRefs.current.set(key, el); }}
										role="option"
										aria-selected={isSelected}
										onClick={() => setIcon(key)}
										onKeyDown={(e) => handleIconKeyDown(e, key)}
										className={cn(
											"grid size-9 place-items-center rounded-[7px] border",
											"transition-[background-color,border-color,box-shadow,transform,color] duration-150",
											"active:scale-[0.93] motion-reduce:active:scale-100",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-panel",
											isSelected
												? `${selectedAccent.bg} ${selectedAccent.ring} ring-1 ${selectedAccent.text} border-transparent`
												: "border-line-soft text-ink-faint hover:border-line-strong hover:text-ink-2",
										)}
									>
										<Icon className="size-4" />
									</button>
								);
							})}
						</div>
					</div>

					{/* ── Color ── */}
					<div className="space-y-2">
						<label className="font-bold text-ink-3 text-[11px] uppercase tracking-widest">
							Color
						</label>
						<div className="flex gap-2" role="radiogroup" aria-label="Space color">
							{ACCENT_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									ref={(el) => { if (el) colorRefs.current.set(opt.value, el); }}
									role="radio"
									aria-checked={color === opt.value}
									onClick={() => setColor(opt.value)}
									onKeyDown={(e) => handleColorKeyDown(e, opt.value)}
									className={cn(
										"flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] border",
										"font-semibold text-xs",
										"transition-[background-color,border-color,box-shadow,transform,color] duration-150",
										"active:scale-[0.95] motion-reduce:active:scale-100",
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-1 focus-visible:ring-offset-panel",
										color === opt.value
											? `${opt.bg} ${opt.ring} ring-1 ${opt.text} border-transparent`
											: "border-line-soft text-ink-faint hover:border-line-strong hover:text-ink-muted",
									)}
								>
									<span className={cn("size-2 rounded-full", opt.dot)} />
									{opt.label}
								</button>
							))}
						</div>
					</div>

					{/* ── Preview ── */}
					<div className="space-y-2">
						<label className="font-bold text-ink-3 text-[11px] uppercase tracking-widest">
							Preview
						</label>
						<div
							className={cn(
								"flex items-center gap-3 rounded-[7px] border px-3 py-2.5",
								"transition-[background-color,box-shadow,border-color,color] duration-200",
								`${selectedAccent.bg} ${selectedAccent.ring} ring-1 border-transparent`,
							)}
						>
							{(() => {
								const Icon = Icons[SPACE_ICONS[icon] ?? "sparkles"];
								return <Icon className={cn("size-4 transition-colors duration-200", selectedAccent.text)} />;
							})()}
							<span className={cn("font-semibold text-sm transition-colors duration-200", selectedAccent.text)}>
								{name.trim() || "Untitled"}
							</span>
						</div>
					</div>
				</div>

				<DialogFooter className="border-line-soft border-t px-5 py-3">
					<Button
						variant="ghost"
						onClick={closeEditSpaceDialog}
						className={cn(
							"rounded-[8px] text-ink-muted hover:text-white",
							"transition-[color,background-color,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={!canSave}
						className={cn(
							"rounded-[8px] bg-brand font-semibold text-brand-ink hover:bg-brand-bright disabled:opacity-30",
							"transition-[background-color,opacity,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Save changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
