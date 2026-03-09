export type ExtensionErrorOperation =
	| "runtime_context"
	| "storage"
	| "tab_query"
	| "save_logic"
	| "list_load"
	| "list_rename"
	| "list_delete"
	| "options_page";

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

export function logExtensionError(
	message: string,
	error: unknown,
	operation: ExtensionErrorOperation | { operation: ExtensionErrorOperation },
): void {
	const resolvedOperation =
		typeof operation === "string" ? operation : operation.operation;
	console.error(`[tabmd:${resolvedOperation}] ${message}`, error);
}

export function formatTimestamp(timestamp: number): string {
	return TIMESTAMP_FORMATTER.format(new Date(timestamp));
}

/**
 * Settings is a dedicated management surface, so it should open in its own browser window
 * instead of being mixed into the user's note tabs.
 */
export async function openExtensionPageInWindow(path: string): Promise<void> {
	await chrome.windows.create({
		url: chrome.runtime.getURL(path),
		type: "normal",
		focused: true,
	});
}

/**
 * Executes async work with a small worker pool so callers can bound concurrency
 * without falling back to serialized loops or unbounded `Promise.all`.
 */
export async function runWithConcurrency<T>(
	items: readonly T[],
	limit: number,
	task: (item: T) => Promise<void>,
): Promise<void> {
	if (items.length === 0) {
		return;
	}

	const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length));
	let nextIndex = 0;

	const workers = Array.from({ length: workerCount }, async () => {
		while (nextIndex < items.length) {
			const current = items[nextIndex];
			nextIndex += 1;

			if (current !== undefined) {
				await task(current);
			}
		}
	});

	await Promise.all(workers);
}
