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
