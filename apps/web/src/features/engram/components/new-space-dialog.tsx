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

import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import type { Accent } from "../types";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

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
	{ value: "violet", label: "Violet", bg: "bg-[#251f38]", ring: "ring-[#907ce8]/50", text: "text-[#c4b5fd]", dot: "bg-[#907ce8]" },
	{ value: "gold", label: "Gold", bg: "bg-[#2a2317]", ring: "ring-[#d9a82f]/50", text: "text-[#e5b83d]", dot: "bg-[#d9a82f]" },
	{ value: "teal", label: "Teal", bg: "bg-[#162624]", ring: "ring-[#43b6a6]/50", text: "text-[#7dd4c6]", dot: "bg-[#43b6a6]" },
	{ value: "red", label: "Red", bg: "bg-[#2a1a17]", ring: "ring-[#e46f50]/50", text: "text-[#f07d5e]", dot: "bg-[#e46f50]" },
	{ value: "blue", label: "Blue", bg: "bg-[#162230]", ring: "ring-[#4aa5c8]/50", text: "text-[#58b8d8]", dot: "bg-[#4aa5c8]" },
];

type Section = "name" | "icon" | "color";

export function NewSpaceDialog() {
	const { newSpaceDialogOpen, closeNewSpaceDialog } = useUIStore();
	const { createSpace } = useEngramStore();

	const [name, setName] = useState("");
	const [icon, setIcon] = useState<SpaceIconKey>("sparkles");
	const [color, setColor] = useState<Accent>("violet");
	const [section, setSection] = useState<Section>("name");

	const inputRef = useRef<HTMLInputElement>(null);
	const iconRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
	const colorRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

	const canCreate = name.trim().length > 0;

	// Focus the active section when it changes
	useEffect(() => {
		if (!newSpaceDialogOpen) return;
		requestAnimationFrame(() => {
			if (section === "name") {
				inputRef.current?.focus();
			} else if (section === "icon") {
				iconRefs.current.get(icon)?.focus();
			} else if (section === "color") {
				colorRefs.current.get(color)?.focus();
			}
		});
	}, [section, newSpaceDialogOpen, icon, color]);

	// Auto-focus name input when dialog opens
	useEffect(() => {
		if (newSpaceDialogOpen) {
			setSection("name");
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [newSpaceDialogOpen]);

	const handleCreate = useCallback(() => {
		if (!canCreate) return;
		createSpace({ name: name.trim(), icon, color });
		setName("");
		setIcon("sparkles");
		setColor("violet");
		setSection("name");
		closeNewSpaceDialog();
	}, [canCreate, name, icon, color, createSpace, closeNewSpaceDialog]);

	// Global Ctrl/Cmd+Enter shortcut while dialog is open
	useEffect(() => {
		if (!newSpaceDialogOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canCreate) {
				e.preventDefault();
				handleCreate();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [newSpaceDialogOpen, canCreate, handleCreate]);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeNewSpaceDialog();
			setName("");
			setIcon("sparkles");
			setColor("violet");
			setSection("name");
		}
	};

	// ── Icon grid keyboard navigation ──
	const handleIconKeyDown = useCallback(
		(e: React.KeyboardEvent, key: SpaceIconKey) => {
			const idx = ICON_KEYS.indexOf(key);
			let nextIdx = idx;

			if (e.key === "ArrowRight") {
				nextIdx = Math.min(idx + 1, ICON_KEYS.length - 1);
			} else if (e.key === "ArrowLeft") {
				nextIdx = Math.max(idx - 1, 0);
			} else if (e.key === "ArrowDown") {
				nextIdx = Math.min(idx + ICON_COLS, ICON_KEYS.length - 1);
			} else if (e.key === "ArrowUp") {
				nextIdx = Math.max(idx - ICON_COLS, 0);
			} else if (e.key === "Tab" && !e.shiftKey) {
				e.preventDefault();
				setSection("color");
				return;
			} else if (e.key === "Tab" && e.shiftKey) {
				e.preventDefault();
				setSection("name");
				return;
			} else {
				return;
			}

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
			} else if (e.key === "Tab" && !e.shiftKey) {
				e.preventDefault();
				// Move focus to Create button — handled by native Tab after this
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
			if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && canCreate)) {
				handleCreate();
			} else if (e.key === "Tab" && !e.shiftKey) {
				// Let default Tab move to icon section
				e.preventDefault();
				setSection("icon");
			}
		},
		[canCreate, handleCreate],
	);

	const selectedAccent = ACCENT_OPTIONS.find((a) => a.value === color)!;

	return (
		<Dialog open={newSpaceDialogOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="rounded-[12px] border-[#2e2b26] bg-[#1a1714] sm:max-w-[420px] p-0 gap-0 overflow-hidden"
			>
				<DialogHeader className="border-[#2e2b26] border-b px-5 py-4">
					<DialogTitle className="font-bold text-white text-base">
						Create a new space
					</DialogTitle>
					<DialogDescription className="text-[#8d857b] text-sm">
						A space is a canvas for a project or area of your life.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5 px-5 py-5">
					{/* ── Name ── */}
					<div className="space-y-2">
						<label className="font-bold text-[#b0a99f] text-[11px] uppercase tracking-widest">
							Name
						</label>
						<Input
							ref={inputRef}
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={handleNameKeyDown}
							placeholder="e.g. Side project, Health, Travel…"
							className="h-10 rounded-[8px] border-[#342f2a] bg-[#211f1c] px-3 text-[15px] text-[#efe9df] placeholder:text-[#5a5450] focus:border-[#4c463e] focus-visible:ring-0"
						/>
					</div>

					{/* ── Icon ── */}
					<div className="space-y-2">
						<label className="font-bold text-[#b0a99f] text-[11px] uppercase tracking-widest">
							Icon
						</label>
						<div className="grid grid-cols-6 gap-1.5" role="listbox" aria-label="Space icon">
							{ICON_KEYS.map((key) => {
								const iconKey = SPACE_ICONS[key];
								const Icon = Icons[iconKey];
								const isSelected = icon === key;
								return (
									<button
										key={key}
										type="button"
										ref={(el) => {
											if (el) iconRefs.current.set(key, el);
										}}
										role="option"
										aria-selected={isSelected}
										onClick={() => setIcon(key)}
										onKeyDown={(e) => handleIconKeyDown(e, key)}
										className={cn(
											"grid size-9 place-items-center rounded-[7px] border",
											"transition-[background-color,border-color,box-shadow,transform,color] duration-150",
											"active:scale-[0.93] motion-reduce:active:scale-100",
											// Focus-visible ring
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907ce8]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1714]",
											isSelected
												? `${selectedAccent.bg} ${selectedAccent.ring} ring-1 ${selectedAccent.text} border-transparent`
												: "border-[#2e2b26] text-[#6b6560] hover:border-[#3a3530] hover:text-[#c8bfb2]",
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
						<label className="font-bold text-[#b0a99f] text-[11px] uppercase tracking-widest">
							Color
						</label>
						<div className="flex gap-2" role="radiogroup" aria-label="Space color">
							{ACCENT_OPTIONS.map((opt) => (
								<button
									key={opt.value}
									type="button"
									ref={(el) => {
										if (el) colorRefs.current.set(opt.value, el);
									}}
									role="radio"
									aria-checked={color === opt.value}
									onClick={() => setColor(opt.value)}
									onKeyDown={(e) => handleColorKeyDown(e, opt.value)}
									className={cn(
										"flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[7px] border",
										"font-semibold text-xs",
										"transition-[background-color,border-color,box-shadow,transform,color] duration-150",
										"active:scale-[0.95] motion-reduce:active:scale-100",
										// Focus-visible ring
										"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#907ce8]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[#1a1714]",
										color === opt.value
											? `${opt.bg} ${opt.ring} ring-1 ${opt.text} border-transparent`
											: "border-[#2e2b26] text-[#6b6560] hover:border-[#3a3530] hover:text-[#9a9088]",
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
						<label className="font-bold text-[#b0a99f] text-[11px] uppercase tracking-widest">
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
								return (
									<Icon
										className={cn(
											"size-4 transition-colors duration-200",
											selectedAccent.text,
										)}
									/>
								);
							})()}
							<span
								className={cn(
									"font-semibold text-sm transition-colors duration-200",
									selectedAccent.text,
								)}
							>
								{name.trim() || "Untitled"}
							</span>
						</div>
					</div>
				</div>

				<DialogFooter className="border-[#2e2b26] border-t px-5 py-3">
					<Button
						variant="ghost"
						onClick={closeNewSpaceDialog}
						className={cn(
							"rounded-[8px] text-[#8d857b] hover:text-white",
							"transition-[color,background-color,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Cancel
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!canCreate}
						className={cn(
							"rounded-[8px] bg-[#907ce8] font-semibold text-[#17131f] hover:bg-[#a08ef2] disabled:opacity-30",
							"transition-[background-color,opacity,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Create space
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
