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
import { cn } from "@alphonse/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

import { SPACE_ICONS, type SpaceIconKey } from "../nav";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

export function DeleteSpaceDialog() {
	const { deletingSpaceId, closeDeleteSpaceDialog } = useUIStore();
	const { spaces, deleteSpace } = useEngramStore();

	const space = spaces.find((s) => s.id === deletingSpaceId);
	const isOpen = !!deletingSpaceId;

	const [confirmText, setConfirmText] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const deleteButtonRef = useRef<HTMLButtonElement>(null);

	const canDelete = confirmText.trim().toLowerCase() === "delete";

	const handleDelete = useCallback(() => {
		if (!canDelete || !deletingSpaceId) return;
		deleteSpace(deletingSpaceId);
		setConfirmText("");
		closeDeleteSpaceDialog();
	}, [canDelete, deletingSpaceId, deleteSpace, closeDeleteSpaceDialog]);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmText("");
			closeDeleteSpaceDialog();
		}
	};

	// Auto-focus delete button when dialog opens
	useEffect(() => {
		if (isOpen) {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isOpen]);

	// Ctrl/Cmd+Enter shortcut
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canDelete) {
				e.preventDefault();
				handleDelete();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, canDelete, handleDelete]);

	if (!space) return null;

	const iconKey = (space.icon in SPACE_ICONS ? space.icon : "sparkles") as SpaceIconKey;
	const Icon = Icons[SPACE_ICONS[iconKey]];

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				showCloseButton={false}
				className="rounded-[12px] border-line-soft bg-panel sm:max-w-[400px] p-0 gap-0 overflow-hidden"
			>
				<DialogHeader className="border-line-soft border-b px-5 py-4">
					<DialogTitle className="font-bold text-white text-base">
						Delete space
					</DialogTitle>
					<DialogDescription className="text-ink-muted text-sm">
						This action cannot be undone.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 px-5 py-5">
					{/* Space info */}
					<div className="flex items-center gap-3 rounded-[7px] border border-line-soft bg-surface px-3 py-2.5">
						<Icon className="size-4 text-ink-3" />
						<span className="font-semibold text-sm text-ink">{space.name}</span>
						<span className="ml-auto text-ink-ghost text-xs">
							{spaces.length - 1 > 0 ? `${spaces.length - 1} space${spaces.length - 1 > 1 ? "s" : ""} will remain` : "Last space"}
						</span>
					</div>

					{/* Warning */}
					<p className="text-ink-3 text-sm leading-relaxed">
						All items and links inside <strong className="text-ink">{space.name}</strong> will be permanently deleted. Type <strong className="text-coral">delete</strong> to confirm.
					</p>

					{/* Confirmation input */}
					<input
						ref={inputRef}
						value={confirmText}
						onChange={(e) => setConfirmText(e.target.value)}
						placeholder='Type "delete" to confirm'
						className="h-10 w-full rounded-[8px] border border-raise bg-surface px-3 text-[15px] text-ink placeholder:text-ink-ghost focus:border-line-max focus-visible:ring-0 focus:outline-none"
					/>
				</div>

				<DialogFooter className="border-line-soft border-t px-5 py-3">
					<Button
						variant="ghost"
						onClick={() => handleOpenChange(false)}
						className={cn(
							"rounded-[8px] text-ink-muted hover:text-white",
							"transition-[color,background-color,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Cancel
					</Button>
					<Button
						ref={deleteButtonRef}
						onClick={handleDelete}
						disabled={!canDelete}
						className={cn(
							"rounded-[8px] bg-coral font-semibold text-white hover:bg-coral disabled:opacity-30",
							"transition-[background-color,opacity,transform] duration-150",
							"active:scale-[0.97] motion-reduce:active:scale-100",
						)}
					>
						Delete space
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
