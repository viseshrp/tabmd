import { getEditorContent } from "./editor";
import { writeNote, type NoteRecord } from "../shared/notes";
import { logExtensionError } from "../shared/utils";

let currentNote: NoteRecord | null = null;
let lastSavedContentStr: string | null = null;
let lastSavedTitle: string | null = null;
let listenersRegistered = false;

export function initSaveTracking(initialNote: NoteRecord) {
	currentNote = initialNote;
	lastSavedContentStr = initialNote.content;
	lastSavedTitle = initialNote.title;

	if (listenersRegistered) {
		return;
	}

	listenersRegistered = true;

	// Register the lifecycle hooks once, then swap the active note snapshot whenever a tab is bootstrapped.
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			void performSave();
		}
	});

	// Save on unmount / crash fallback
	window.addEventListener("beforeunload", () => {
		void performSave();
	});
}

// Ensure the local 'currentNote' object receives title updates from the UI
export function updateNoteTitle(title: string | null) {
	if (currentNote) {
		currentNote.title = title;
	}
}

async function performSave(): Promise<void> {
	if (!currentNote) return;

	const currentContent = getEditorContent();
	if (
		currentContent === lastSavedContentStr &&
		currentNote.title === lastSavedTitle
	) {
		return;
	}

	try {
		const updatedNote: NoteRecord = {
			...currentNote,
			content: currentContent,
			modifiedAt: Date.now(),
		};
		await writeNote(updatedNote);
		lastSavedContentStr = currentContent;
		lastSavedTitle = updatedNote.title;
		currentNote = updatedNote;
	} catch (err: unknown) {
		logExtensionError("Failed to save note on blur", err, "save_logic");
	}
}
