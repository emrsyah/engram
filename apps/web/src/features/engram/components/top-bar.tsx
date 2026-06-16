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
		<header className="relative flex h-14 shrink-0 items-center justify-between border-[#292622] border-b bg-[#171512] px-5">
			<div className="flex min-w-0 items-center gap-3">
				{sidebarCollapsed && (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={toggleSidebar}
						title="Open sidebar  ["
						className="mr-1 text-[#706a62] hover:text-[#c8bfb2]"
					>
						<Icons.chevronRight className="size-4" />
					</Button>
				)}
				<Icons.layout className="size-4 text-[#8a8378]" />
				<h1 className="truncate font-bold text-white">
					{ROUTE_TITLES[pathname] ?? activeSpace?.name ?? "Mind"}
				</h1>
			</div>

			<div className="flex items-center gap-4">
				<div className="hidden rounded-[8px] bg-[#23201d] p-1 lg:flex">
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
										? "bg-[#312d28] text-white shadow-sm"
										: "text-[#948c82] hover:text-white",
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
					className="hidden h-10 w-[260px] justify-between rounded-[8px] border-[#342f2a] bg-[#211f1c] px-3 text-[#8d857a] text-sm xl:flex"
				>
					<span className="flex items-center gap-2">
						<Icons.search className="size-4" />
						Search
					</span>
					<span className="rounded-[5px] bg-[#34302b] px-2 py-0.5 font-mono text-xs">
						Cmd+K
					</span>
				</Button>

				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					onClick={openShortcuts}
					title="Keyboard shortcuts  ?"
					className="hidden size-8 text-[#706a62] hover:text-[#c8bfb2] lg:grid"
				>
					<Icons.keyboard className="size-4" />
				</Button>

				<Button
					type="button"
					onClick={() =>
						expandQuickCapture(pathname === "/library" ? "thought" : "task")
					}
					className="h-10 rounded-[8px] bg-[#907ce8] px-4 font-bold text-[#17131f] transition-transform duration-100 hover:bg-[#a08ef2] active:scale-[0.97]"
				>
					<Icons.plus className="size-4" />
					Capture
					<span className="ml-1 font-mono text-xs opacity-70">N</span>
				</Button>
			</div>
		</header>
	);
}
