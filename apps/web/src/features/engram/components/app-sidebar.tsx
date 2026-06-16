"use client";

import { Button, buttonVariants } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_VIEWS } from "../nav";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const navItemClass = "h-[40px] w-full justify-start gap-3 rounded-[7px] px-3 py-2 text-sm font-semibold";

export function AppSidebar() {
	const pathname = usePathname();
	const { sidebarCollapsed, toggleSidebar } = useUIStore();

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

			<div className="mt-auto flex items-center justify-between px-5 py-5 text-ink-dim">
				<Icons.search className="size-4" />
				<Icons.settings className="size-4" />
				<Icons.info className="size-4" />
			</div>
		</aside>
	);
}
