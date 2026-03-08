import { getEditorContent } from "./editor";
import { writeNote, type NoteRecord } from "../shared/notes";
import { logExtensionError } from "../shared/utils";

let currentNote: NoteRecord | null = null;
let lastSavedContentStr: string | null = null;
let lastSavedTitle: string | null = null;
let listenersRegistered = false;
let saveInFlight: Promise<void> | null = null;
let saveRequestedWhileBusy = false;

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
			void saveCurrentNote();
		}
	});

	// Save on unmount / crash fallback
	window.addEventListener("beforeunload", () => {
		void saveCurrentNote();
	});
}

// Ensure the local 'currentNote' object receives title updates from the UI
export function updateNoteTitle(title: string | null) {
	if (currentNote) {
		currentNote.title = title;
	}
}

/**
 * Accepts storage-driven note changes as the new baseline so local no-op checks stay correct.
 * Without this, a remote rename or content edit would be immediately overwritten by stale in-memory state.
 */
export function replaceTrackedNote(nextNote: NoteRecord): void {
	currentNote = nextNote;
	lastSavedContentStr = nextNote.content;
	lastSavedTitle = nextNote.title;
}

/**
 * Runs saves serially and coalesces bursts of edits into the freshest available snapshot.
 * This is the cheapest timer-free path to instant sync because writes never overlap and exact no-ops are skipped.
 */
export function saveCurrentNote(): Promise<void> {
	saveRequestedWhileBusy = true;
	if (saveInFlight) {
		return saveInFlight;
	}

	saveInFlight = (async () => {
		try {
			while (saveRequestedWhileBusy) {
				saveRequestedWhileBusy = false;
				await performSave();
			}
		} finally {
			saveInFlight = null;

			if (saveRequestedWhileBusy) {
				void saveCurrentNote();
			}
		}
	})();

	return saveInFlight;
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
		// `modifiedAt` is updated only for persisted edits so list and popup ordering match what other surfaces receive.
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
		logExtensionError(
			"Failed to save note during real-time sync",
			err,
			"save_logic",
		);
	}
}
