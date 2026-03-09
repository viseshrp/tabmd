import { resolveNoteTitle } from "../shared/note_title";
import { updateNoteTitle } from "./save";
import { getEditorContent } from "./editor";

let currentTitle: string | null = null;

/**
 * The browser tab label should match the same resolved title that the page header shows.
 * Keeping both surfaces behind one helper prevents them from drifting apart as content changes.
 */
function syncResolvedTitle(title: string | null, content: string): void {
	const resolvedTitle = resolveNoteTitle({ title, content });
	const display = document.getElementById(
		"note-title-display",
	) as HTMLHeadingElement | null;

	if (display) {
		display.textContent = resolvedTitle;
	}

	document.title = resolvedTitle;
}

export function initTitleActions(
	initialTitle: string | null,
	initialContent: string,
) {
	const display = document.getElementById(
		"note-title-display",
	) as HTMLHeadingElement;
	const input = document.getElementById("note-title-input") as HTMLInputElement;

	if (!display || !input) return;

	// Shared title state lets local edits and storage-driven updates resolve against the same committed value.
	currentTitle = initialTitle;

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
			input.value = getTitleForEditing(currentTitle, getEditorContent());
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
	input.value = getTitleForEditing(currentTitle, getEditorContent());
	input.focus();
}

/**
 * Editing should start from the same title text the user can already see.
 * When the title is auto-derived from content, this avoids opening an empty input.
 */
function getTitleForEditing(
	titleObjState: string | null,
	content: string,
): string {
	return resolveNoteTitle({ title: titleObjState, content });
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
	syncResolvedTitle(title, content);
}

/**
 * Applies the latest committed title and content from either the editor or storage.
 * Auto titles follow content instantly, while manual titles remain stable until the user changes them.
 */
export function applyTitleState(title: string | null, content: string): void {
	currentTitle = title;
	syncTitleDisplay(currentTitle, content);
}

export function getCommittedTitle(): string | null {
	return currentTitle;
}
