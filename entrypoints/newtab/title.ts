import { resolveNoteTitle } from "../shared/note_title";
import { updateNoteTitle } from "./save";
import { getEditorContent } from "./editor";

export function initTitleActions(
	initialTitle: string | null,
	initialContent: string,
) {
	const display = document.getElementById(
		"note-title-display",
	) as HTMLHeadingElement;
	const input = document.getElementById("note-title-input") as HTMLInputElement;

	if (!display || !input) return;

	// Keep the last committed title in closure state so reopen/cancel flows stay in sync with the saved model.
	let currentTitle = initialTitle;

	// Sync initial state
	syncTitleDisplay(currentTitle, initialContent);

	display.addEventListener("click", () => {
		showTitleEditor(display, input, currentTitle);
	});

	input.addEventListener("blur", () => {
		currentTitle = commitTitle(input, display);
	});

	input.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter") {
			input.blur();
		}
		if (e.key === "Escape") {
			// Revert to the latest committed title instead of the original bootstrap value.
			input.value = getTitleForEditing(currentTitle);
			input.blur();
		}
	});
}

function showTitleEditor(
	display: HTMLHeadingElement,
	input: HTMLInputElement,
	currentTitle: string | null,
) {
	display.hidden = true;
	input.hidden = false;
	input.value = getTitleForEditing(currentTitle);
	input.focus();
}

function getTitleForEditing(titleObjState: string | null): string {
	return titleObjState ?? "";
}

function commitTitle(
	input: HTMLInputElement,
	display: HTMLHeadingElement,
): string | null {
	const raw = input.value;
	const newTitle = raw.trim() === "" ? null : raw.trim();

	// Update internal model
	updateNoteTitle(newTitle);

	// Return to display Mode
	input.hidden = true;
	display.hidden = false;

	// Visual sync
	syncTitleDisplay(newTitle, getEditorContent());

	return newTitle;
}

export function syncTitleDisplay(title: string | null, content: string) {
	const display = document.getElementById(
		"note-title-display",
	) as HTMLHeadingElement;
	if (!display) return;
	display.textContent = resolveNoteTitle({ title, content });
}
