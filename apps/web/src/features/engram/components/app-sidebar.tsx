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
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

import { NAV_VIEWS } from "../nav";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const navItemClass = "h-[40px] w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-sm font-semibold";

export function AppSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { sidebarCollapsed, toggleSidebar } = useUIStore();

	const [confirmLogout, setConfirmLogout] = useState(false);
	const [signingOut, setSigningOut] = useState(false);

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
		<aside
			className={cn(
				"hidden shrink-0 border-line border-r bg-void text-ink-2 md:flex md:flex-col",
				"overflow-hidden transition-[width] duration-200",
				sidebarCollapsed ? "w-0 border-r-0" : "w-[220px]",
			)}
		>
			<div className="flex h-16 w-[220px] items-center justify-between px-5">
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
					className="text-ink-faint hover:text-ink-2"
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
	);
}
