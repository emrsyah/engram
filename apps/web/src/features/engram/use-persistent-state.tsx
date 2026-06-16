"use client";

import { useEffect, useState } from "react";

/**
 * Drop-in replacement for useState that persists the value to localStorage so
 * it survives both client navigation *and* a full reload.
 *
 * SSR-safe: the first render always uses `initial` (matching server HTML), then
 * the stored value is loaded in an effect after mount to avoid hydration
 * mismatches. Writes are gated until after that load so the stored value is
 * never clobbered by the initial default.
 */
export function usePersistentState<T>(
	key: string,
	initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
	const [state, setState] = useState<T>(initial);
	const [hydrated, setHydrated] = useState(false);

	// Load once on mount.
	useEffect(() => {
		try {
			const raw = localStorage.getItem(key);
			if (raw != null) setState(JSON.parse(raw) as T);
		} catch {
			// ignore corrupt / unavailable storage — fall back to `initial`
		}
		setHydrated(true);
	}, [key]);

	// Persist on change, but only after the stored value has been loaded.
	useEffect(() => {
		if (!hydrated) return;
		try {
			localStorage.setItem(key, JSON.stringify(state));
		} catch {
			// ignore quota / unavailable storage
		}
	}, [key, state, hydrated]);

	return [state, setState];
}
