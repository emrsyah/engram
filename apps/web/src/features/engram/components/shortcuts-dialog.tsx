"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alphonse/ui/components/dialog";

import { useUIStore } from "../ui-store";

const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
const mod = isMac ? "Cmd" : "Ctrl";

const SECTIONS: { title: string; shortcuts: { keys: string[]; label: string }[] }[] = [
	{
		title: "Navigation",
		shortcuts: [
			{ keys: ["1"], label: "Go to Tasks" },
			{ keys: ["2"], label: "Go to Library" },
			{ keys: ["["], label: "Toggle sidebar" },
		],
	},
	{
		title: "Actions",
		shortcuts: [
			{ keys: ["N"], label: "Quick capture" },
			{ keys: [mod, "T"], label: "Capture task" },
			{ keys: [mod, "K"], label: "Search" },
			{ keys: ["/"], label: "Search" },
			{ keys: ["?"], label: "Show shortcuts" },
			{ keys: [mod, "Z"], label: "Undo delete" },
		],
	},
];

export function ShortcutsDialog() {
	const { shortcutsOpen, closeShortcuts } = useUIStore();

	return (
		<Dialog open={shortcutsOpen} onOpenChange={(open) => !open && closeShortcuts()}>
			<DialogContent className="gap-0 overflow-hidden border-[#302c27] bg-[#18161380] p-0 backdrop-blur-xl sm:max-w-[480px]">
				<DialogHeader className="border-[#2a2621] border-b px-6 pt-6 pb-4">
					<DialogTitle className="font-bold text-base text-white">Keyboard shortcuts</DialogTitle>
				</DialogHeader>

				<div className="grid gap-x-8 gap-y-6 px-6 py-5 sm:grid-cols-2">
					{SECTIONS.map((section) => (
						<div key={section.title}>
							<p className="mb-3 font-bold text-[#736c63] text-[11px] uppercase tracking-[0.12em]">
								{section.title}
							</p>
							<div className="space-y-2">
								{section.shortcuts.map((shortcut) => (
									<div key={shortcut.label} className="flex items-center justify-between gap-4">
										<span className="text-[#b0a99f] text-sm">{shortcut.label}</span>
										<span className="flex shrink-0 items-center gap-1">
											{shortcut.keys.map((key) => (
												<kbd
													key={key}
													className="min-w-[22px] rounded-[4px] border border-[#3a3530] bg-[#252220] px-1.5 py-0.5 text-center font-mono text-[#9a9088] text-[11px]"
												>
													{key}
												</kbd>
											))}
										</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
