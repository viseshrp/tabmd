import {
	listNotesSorted,
	deleteNote,
	writeNote,
	readNote,
} from "../shared/notes";
import { type NoteRecord, readSettings } from "../shared/storage";
import {
	buildSearchIndex,
	filterIndexedNotes,
	type SearchIndexEntry,
	type SearchResult,
} from "./search";
import { formatTimestamp, logExtensionError } from "../shared/utils";
import { createSnackbarNotifier } from "../ui/notifications";

let allNotes: NoteRecord[] = [];
let searchIndex: SearchIndexEntry[] = [];
let notify: ReturnType<typeof createSnackbarNotifier>;
let pageElements: ListPageElements | null = null;

type ListPageElements = {
	searchInput: HTMLInputElement;
	countBadge: HTMLElement;
	grid: HTMLElement;
	emptyState: HTMLElement;
	noResults: HTMLElement;
	snackbar: HTMLElement | null;
};

async function bootstrap() {
	const settings = await readSettings();
	if (settings.theme === "light" || settings.theme === "dark") {
		document.documentElement.setAttribute("data-theme", settings.theme);
	}

	pageElements = collectPageElements();
	if (!pageElements) {
		return;
	}

	notify = createSnackbarNotifier(pageElements.snackbar);

	await loadNotes();

	pageElements.searchInput.addEventListener("input", () => {
		renderNotes(pageElements?.searchInput.value ?? "");
	});

	document.getElementById("btn-new-note")?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("newtab.html") });
	});

	document.getElementById("btn-options")?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
	});
}

async function loadNotes() {
	try {
		allNotes = await listNotesSorted();
		searchIndex = buildSearchIndex(allNotes);
		renderNotes(pageElements?.searchInput.value ?? "");
	} catch (err) {
		logExtensionError("Failed to load notes", err, "list_load");
		notify.notify("Error loading notes");
	}
}

function renderNotes(query: string) {
	if (!pageElements) return;

	const { countBadge, grid, emptyState, noResults } = pageElements;
	countBadge.textContent = allNotes.length.toString();

	if (allNotes.length === 0) {
		grid.replaceChildren();
		emptyState.hidden = false;
		noResults.hidden = true;
		grid.hidden = true;
		return;
	}

	emptyState.hidden = true;

	const results = filterIndexedNotes(searchIndex, query);

	if (results.length === 0) {
		grid.replaceChildren();
		noResults.hidden = false;
		grid.hidden = true;
		return;
	}

	noResults.hidden = true;
	grid.hidden = false;

	const cardsFragment = document.createDocumentFragment();
	for (const result of results) {
		cardsFragment.appendChild(createNoteCard(result));
	}
	grid.replaceChildren(cardsFragment);
}

function createNoteCard(result: SearchResult): HTMLElement {
	const card = document.createElement("div");
	card.className = "note-card";

	// Card Content
	const contentDiv = document.createElement("div");
	contentDiv.className = "note-card-content";
	contentDiv.style.cursor = "pointer";
	contentDiv.addEventListener("click", () => {
		chrome.tabs.create({
			url: `${chrome.runtime.getURL("newtab.html")}#${result.note.id}`,
		});
	});

	const titleEl = document.createElement("h3");
	titleEl.className = "note-title";
	titleEl.textContent = result.title;

	const snippetEl = document.createElement("p");
	snippetEl.className = "note-snippet";
	snippetEl.textContent = result.snippet;

	const metaEl = document.createElement("div");
	metaEl.className = "note-meta";
	metaEl.textContent = formatTimestamp(result.note.modifiedAt);

	contentDiv.appendChild(titleEl);
	contentDiv.appendChild(snippetEl);
	contentDiv.appendChild(metaEl);

	// Card Actions
	const actionsDiv = document.createElement("div");
	actionsDiv.className = "note-card-actions";

	const btnRename = document.createElement("button");
	btnRename.className = "action-btn";
	btnRename.textContent = "Rename";
	btnRename.addEventListener("click", (e) => {
		e.stopPropagation();
		handleRename(result.note.id, result.title);
	});

	const btnDelete = document.createElement("button");
	btnDelete.className = "action-btn delete-btn";
	btnDelete.textContent = "Delete";
	btnDelete.addEventListener("click", (e) => {
		e.stopPropagation();
		handleDelete(result.note.id, result.title);
	});

	actionsDiv.appendChild(btnRename);
	actionsDiv.appendChild(btnDelete);

	card.appendChild(contentDiv);
	card.appendChild(actionsDiv);

	return card;
}

async function handleRename(id: string, currentTitle: string) {
	const newName = window.prompt(`Rename note:`, currentTitle);
	if (newName === null) return; // cancelled

	const newTitle = newName.trim() === "" ? null : newName.trim();
	try {
		const note = await readNote(id);
		if (note) {
			note.title = newTitle;
			note.modifiedAt = Date.now();
			await writeNote(note);
			await loadNotes();
		}
	} catch (err) {
		logExtensionError("Failed to rename note", err, "list_rename");
		notify.notify("Failed to rename note");
	}
}

async function handleDelete(id: string, currentTitle: string) {
	const confirmed = window.confirm(
		`Delete '${currentTitle}'? This cannot be undone.`,
	);
	if (!confirmed) return;

	try {
		await deleteNote(id);
		await loadNotes();
		notify.notify("Note deleted");
	} catch (err) {
		logExtensionError("Failed to delete note", err, "list_delete");
		notify.notify("Failed to delete note");
	}
}

function collectPageElements(): ListPageElements | null {
	const searchInput = document.getElementById("search-input");
	const countBadge = document.getElementById("note-count");
	const grid = document.getElementById("notes-grid");
	const emptyState = document.getElementById("empty-state");
	const noResults = document.getElementById("no-results");

	if (
		!(searchInput instanceof HTMLInputElement) ||
		!(countBadge instanceof HTMLElement) ||
		!(grid instanceof HTMLElement) ||
		!(emptyState instanceof HTMLElement) ||
		!(noResults instanceof HTMLElement)
	) {
		return null;
	}

	return {
		searchInput,
		countBadge,
		grid,
		emptyState,
		noResults,
		snackbar: document.getElementById("snackbar"),
	};
}

bootstrap().catch(console.error);
