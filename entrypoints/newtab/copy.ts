import type { UiNotifier } from "../ui/notifications";

/**
 * Centralizes clipboard writes so the toolbar can stay declarative and every
 * copy outcome surfaces the same user feedback.
 */
export async function copyEditorText(
	content: string,
	notifier?: UiNotifier,
): Promise<boolean> {
	const clipboard = navigator.clipboard;
	if (!clipboard?.writeText) {
		notifier?.notify("Clipboard unavailable");
		return false;
	}

	try {
		await clipboard.writeText(content);
		notifier?.notify("Note copied");
		return true;
	} catch {
		// Clipboard access can fail because of permission or browser policy, so the caller only needs a simple failure signal.
		notifier?.notify("Failed to copy note");
		return false;
	}
}
