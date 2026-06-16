"use client";

import { Button, buttonVariants } from "@alphonse/ui/components/button";
import { cn } from "@alphonse/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_VIEWS } from "../nav";
import { useEngramStore } from "../store";
import { useUIStore } from "../ui-store";
import { Icons } from "./icons";

const ROUTE_TITLES: Record<string, string> = {
	"/tasks": "Tasks",
	"/library": "Library",
};

export function TopBar() {
	const pathname = usePathname();
	const { activeSpace } = useEngramStore();
	const {
		openSearch,
		expandQuickCapture,
		sidebarCollapsed,
		toggleSidebar,
		openShortcuts,
	} = useUIStore();

	return (
		<header className="relative flex h-14 shrink-0 items-center justify-between border-line border-b bg-base px-5">
			<div className="flex min-w-0 items-center gap-3">
				{sidebarCollapsed && (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={toggleSidebar}
						title="Open sidebar  ["
						className="mr-1 text-ink-faint hover:text-ink-2"
					>
						<Icons.chevronRight className="size-4" />
					</Button>
				)}
				<Icons.layout className="size-4 text-ink-muted" />
				<h1 className="truncate font-bold text-white">
					{ROUTE_TITLES[pathname] ?? activeSpace?.name ?? "Mind"}
				</h1>
			</div>

			<div className="flex items-center gap-4">
				<div className="hidden rounded-[8px] bg-fill p-1 lg:flex">
					{NAV_VIEWS.map(({ href, label, icon }) => {
						const Icon = Icons[icon];
						const active = pathname === href;
						return (
							<Link
								key={href}
								href={href as Route<string>}
								className={cn(
									buttonVariants({
										variant: active ? "secondary" : "ghost",
										size: "sm",
									}),
									"h-8 gap-2 rounded-[6px] px-3 font-semibold",
									active
										? "bg-raise text-white shadow-sm"
										: "text-ink-muted hover:text-white",
								)}
							>
								<Icon className="size-4" />
								{label}
							</Link>
						);
					})}
				</div>

				<Button
					type="button"
					variant="outline"
					onClick={openSearch}
					className="hidden h-10 w-[260px] justify-between rounded-[8px] border-raise bg-surface px-3 text-ink-muted text-sm xl:flex"
				>
					<span className="flex items-center gap-2">
						<Icons.search className="size-4" />
						Search
					</span>
					<span className="rounded-[5px] bg-raise px-2 py-0.5 font-mono text-xs">
						Cmd+K
					</span>
				</Button>

				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					onClick={openShortcuts}
					title="Keyboard shortcuts  ?"
					className="hidden size-8 text-ink-faint hover:text-ink-2 lg:grid"
				>
					<Icons.keyboard className="size-4" />
				</Button>

				<Button
					type="button"
					onClick={() =>
						expandQuickCapture(pathname === "/library" ? "thought" : "task")
					}
					className="h-10 rounded-[8px] bg-brand px-4 font-bold text-brand-ink transition-transform duration-100 hover:bg-brand-bright active:scale-[0.97]"
				>
					<Icons.plus className="size-4" />
					Capture
					<span className="ml-1 font-mono text-xs opacity-70">N</span>
				</Button>
			</div>
		</header>
	);
}
