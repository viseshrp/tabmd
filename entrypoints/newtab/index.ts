import {
	initEditor,
	getEditorContent,
	showPreview,
	showEditor,
	setFocusMode,
	toggleFocusMode,
	setEditorContent,
	subscribeToEditorContentChanges,
} from "./editor";
import { readNote, subscribeToNotes, type NoteRecord } from "../shared/notes";
import { generateUUID } from "../shared/uuid";
import { initSaveTracking, replaceTrackedNote, saveCurrentNote } from "./save";
import { applyTitleState, getCommittedTitle, initTitleActions } from "./title";
import { performExport } from "./export";
import { readSettings } from "../shared/storage";
import { createSnackbarNotifier } from "../ui/notifications";
import { copyEditorText } from "./copy";

import "./style.css";

async function bootstrap() {
	// 1. Theme application
	const settings = await readSettings();
	if (settings.theme === "light" || settings.theme === "dark") {
		document.documentElement.setAttribute("data-theme", settings.theme);
	}

	// 2. Hash parsing / Note Loading
	let noteId = window.location.hash.slice(1);
	let note: NoteRecord;

	if (!noteId) {
		noteId = generateUUID();
		window.history.replaceState(null, "", `#${noteId}`);
		note = {
			id: noteId,
			content: "",
			title: null,
			createdAt: Date.now(),
			modifiedAt: Date.now(),
		};
	} else {
		const loaded = await readNote(noteId);
		if (loaded) {
			note = loaded;
		} else {
			note = {
				id: noteId,
				content: "",
				title: null,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
			};
		}
	}

	// 3. UI Initialize
	initEditor(note.content);
	initTitleActions(note.title, note.content);
	initSaveTracking(note);
	const notify = createSnackbarNotifier(document.getElementById("snackbar"));

	// Editor edits must update the derived title before saving so every surface receives the same resolved title state.
	subscribeToEditorContentChanges((content) => {
		applyTitleState(getCommittedTitle(), content);
		void saveCurrentNote();
	});

	// Title commits are blur-driven, so listening here keeps the save trigger separate from the display logic.
	document.getElementById("note-title-input")?.addEventListener("blur", () => {
		void saveCurrentNote();
	});

	// Storage changes are the cross-surface source of truth for popup, list, and every open editor instance.
	subscribeToNotes((notes) => {
		const syncedNote = notes[noteId];
		if (!syncedNote) {
			return;
		}

		note = syncedNote;
		replaceTrackedNote(syncedNote);
		applyTitleState(syncedNote.title, syncedNote.content);
		setEditorContent(syncedNote.content);
	});

	// 4. Tab switching logic
	const editorBtn = document.getElementById("tab-editor");
	const previewBtn = document.getElementById("tab-preview");

	function showEditorTab(): void {
		editorBtn?.classList.add("active");
		previewBtn?.classList.remove("active");
		showEditor();
	}

	editorBtn?.addEventListener("click", showEditorTab);

	previewBtn?.addEventListener("click", () => {
		setFocusMode(false);
		previewBtn.classList.add("active");
		editorBtn?.classList.remove("active");
		showPreview();
	});

	// 5. Actions
	const btnFocus = document.getElementById("btn-focus");
	btnFocus?.addEventListener("click", () => {
		// Focus mode should always affect the visible editor, not a hidden instance behind Preview.
		showEditorTab();
		toggleFocusMode();
	});

	const btnExport = document.getElementById("btn-export");
	btnExport?.addEventListener("click", () => {
		performExport(getCommittedTitle(), getEditorContent());
	});

	const btnCopy = document.getElementById("btn-copy");
	btnCopy?.addEventListener("click", () => {
		// Copy always reads from the editor model so preview mode and title edits cannot desynchronize the exported text.
		void copyEditorText(getEditorContent(), notify);
	});

	const btnOptions = document.getElementById("btn-options");
	btnOptions?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
	});
}

bootstrap().catch(console.error);
