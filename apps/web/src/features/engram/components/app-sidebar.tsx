"use client";

import { Button, buttonVariants } from "@alphonse/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@alphonse/ui/components/dialog";
import { cn } from "@alphonse/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { haptic } from "../haptics";
import { NAV_VIEWS } from "../nav";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

// Overshoot spring for the drawer's settle — slow-in/slow-out with a touch of
// follow-through so the panel feels physical rather than mechanical.
const DRAWER_SPRING = "cubic-bezier(0.22, 1, 0.36, 1)";
// Past this leftward drag (px) — or a fast enough flick — the drawer dismisses.
const SWIPE_DISMISS_PX = 72;

const navItemClass =
	"h-11 w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-sm font-semibold transition-transform active:scale-[0.98] motion-reduce:active:scale-100 md:h-[40px] md:active:scale-100";

export function AppSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { sidebarCollapsed, toggleSidebar, mobileNavOpen, closeMobileNav } =
		useUIStore();

	const [confirmLogout, setConfirmLogout] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

	// Swipe-to-dismiss: while a touch is active, `dragX` (a non-positive px
	// offset) drives the transform directly — straight-ahead, finger-following
	// motion. Cleared on release so the CSS spring takes over the settle.
	const [dragX, setDragX] = useState<number | null>(null);
	const touch = useRef<{ startX: number; startY: number; t: number; capturing: boolean }>(
		{ startX: 0, startY: 0, t: 0, capturing: false },
	);

	// Lock background scroll + fire a tick when the drawer opens.
	useEffect(() => {
		if (!mobileNavOpen) return;
		haptic("impact");
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, [mobileNavOpen]);

	const onTouchStart = (e: React.TouchEvent) => {
		const t = e.touches[0];
		touch.current = { startX: t.clientX, startY: t.clientY, t: e.timeStamp, capturing: false };
	};
	const onTouchMove = (e: React.TouchEvent) => {
		const t = e.touches[0];
		const dx = t.clientX - touch.current.startX;
		const dy = t.clientY - touch.current.startY;
		// Only hijack once the gesture is clearly horizontal-left (lets the nav
		// list scroll vertically without fighting the drawer).
		if (!touch.current.capturing) {
			if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
			touch.current.capturing = true;
		}
		setDragX(Math.min(0, dx));
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		if (!touch.current.capturing) {
			setDragX(null);
			return;
		}
		const dx = Math.min(0, (dragX ?? 0));
		const dt = Math.max(1, e.timeStamp - touch.current.t);
		const velocity = dx / dt; // px/ms, negative = leftward
		setDragX(null);
		if (dx <= -SWIPE_DISMISS_PX || velocity < -0.5) {
			closeMobileNav();
		}
	};

	const dragging = dragX !== null;

	const handleLogout = async () => {
		setSigningOut(true);
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					router.replace("/login");
				},
				onError: () => {
					setSigningOut(false);
				},
			},
		});
	};

	return (
		<>
			{/* Mobile backdrop — tap to dismiss the drawer */}
			{mobileNavOpen && (
				<button
					type="button"
					aria-label="Close navigation"
					onClick={closeMobileNav}
					className="drawer-backdrop fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
				/>
			)}
			<aside
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
				style={
					dragging
						? { transform: `translateX(${dragX}px)`, transition: "none" }
						: { transitionTimingFunction: DRAWER_SPRING }
				}
				className={cn(
					"flex shrink-0 flex-col border-line border-r bg-void text-ink-2",
					// Mobile: fixed slide-in drawer (safe-area aware)
					"fixed inset-y-0 left-0 z-50 w-[260px] max-w-[80vw] transition-transform duration-300",
					"pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
					mobileNavOpen ? "translate-x-0" : "-translate-x-full",
					// Desktop: in-flow, collapsible width
					"md:static md:z-auto md:max-w-none md:translate-x-0 md:p-0 md:overflow-hidden md:transition-[width]",
					sidebarCollapsed ? "md:w-0 md:border-r-0" : "md:w-[220px]",
				)}
			>
			<div className="flex h-16 w-full items-center justify-between px-5 md:w-[220px]">
				<div className="flex items-center gap-3 font-bold text-lg text-white">
					<img
						src="/favicon.ico"
						alt=""
						aria-hidden="true"
						className="size-7 shrink-0 rounded-[6px]"
					/>
					Engram
				</div>
				{/* Desktop: collapse sidebar */}
				<Button
					variant="ghost"
					size="icon-xs"
					className="hidden text-ink-faint hover:text-ink-2 md:inline-flex"
					onClick={toggleSidebar}
					title="Toggle sidebar  ["
				>
					<Icons.chevronLeft className="size-4" />
				</Button>
				{/* Mobile: close drawer */}
				<Button
					variant="ghost"
					size="icon-xs"
					className="text-ink-faint hover:text-ink-2 md:hidden"
					onClick={closeMobileNav}
					title="Close navigation"
				>
					<Icons.x className="size-4" />
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
							onClick={() => {
								haptic("selection");
								closeMobileNav();
							}}
							className={cn(
								buttonVariants({ variant: "ghost" }),
								navItemClass,
								active
									? "bg-brand-surface text-white"
									: "text-ink-muted hover:bg-fill hover:text-ink-2",
							)}
						>
							<Icon className={cn("size-4", active && "text-brand-soft")} />
							{label}
						</Link>
					);
				})}
			</nav>

			<div className="mt-auto px-3 pb-4">
				<button
					type="button"
					onClick={() => setConfirmLogout(true)}
					className={cn(
						buttonVariants({ variant: "ghost" }),
						navItemClass,
						"text-ink-muted hover:bg-fill hover:text-coral",
					)}
				>
					<Icons.logout className="size-4" />
					Log out
				</button>
			</div>

			<Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
				<DialogContent
					showCloseButton={false}
					className="rounded-[12px] border-line-soft bg-panel sm:max-w-[400px] p-0 gap-0 overflow-hidden"
				>
					<DialogHeader className="border-line-soft border-b px-5 py-4">
						<DialogTitle className="font-bold text-white text-base">
							Log out of Engram?
						</DialogTitle>
						<DialogDescription className="text-ink-muted text-sm">
							You’ll need to sign in with Google again to get back in.
						</DialogDescription>
					</DialogHeader>

					<DialogFooter className="border-line-soft border-t px-5 py-3">
						<Button
							variant="ghost"
							onClick={() => setConfirmLogout(false)}
							disabled={signingOut}
							className={cn(
								"rounded-[8px] text-ink-muted hover:text-white",
								"transition-[color,background-color,transform] duration-150",
								"active:scale-[0.97] motion-reduce:active:scale-100",
							)}
						>
							Cancel
						</Button>
						<Button
							onClick={handleLogout}
							disabled={signingOut}
							className={cn(
								"rounded-[8px] bg-coral font-semibold text-white hover:bg-coral disabled:opacity-30",
								"transition-[background-color,opacity,transform] duration-150",
								"active:scale-[0.97] motion-reduce:active:scale-100",
							)}
						>
							{signingOut ? "Logging out…" : "Log out"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			</aside>
		</>
	);
}
