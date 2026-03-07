import {
	initEditor,
	getEditorContent,
	showPreview,
	showEditor,
	setFocusMode,
	toggleFocusMode,
} from "./editor";
import { readNote, type NoteRecord } from "../shared/notes";
import { generateUUID } from "../shared/uuid";
import { initSaveTracking } from "./save";
import { initTitleActions } from "./title";
import { performExport } from "./export";
import { readSettings } from "../shared/storage";

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
		performExport(note.title, getEditorContent());
	});

	const btnOptions = document.getElementById("btn-options");
	btnOptions?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
	});

	// Global editor text-change to update title derivation real-time if needed
	// But spec says first-line derivation happens on render. We sync on initial render.
}

bootstrap().catch(console.error);
