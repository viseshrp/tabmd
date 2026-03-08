import {
	listRecentNotes,
	selectRecentNotes,
	subscribeToNotes,
	type NoteRecord,
} from "../shared/notes";
import { resolveNoteTitle } from "../shared/note_title";
import { readSettings } from "../shared/storage";
import { POPUP_RECENT_NOTES_LIMIT } from "../shared/ui_limits";

// WXT flattens page entrypoints into top-level HTML files in the built extension,
// so runtime navigation must use `list.html` instead of the source folder path.
const LIST_PAGE_PATH = "list.html";

function renderNotes(notes: NoteRecord[]): void {
	const listContainer = document.getElementById(
		"note-list",
	) as HTMLUListElement;
	const emptyState = document.getElementById("empty-state") as HTMLDivElement;

	if (notes.length === 0) {
		emptyState.hidden = false;
		listContainer.hidden = true;
		listContainer.replaceChildren();
		return;
	}

	emptyState.hidden = true;
	listContainer.hidden = false;

	// The popup stays bounded by a shared recent-note limit, so rebuilding the fragment is small and keeps DOM updates straightforward.
	const notesFragment = document.createDocumentFragment();

	for (const note of notes) {
		const title = resolveNoteTitle({
			title: note.title,
			content: note.content,
		});
		const li = document.createElement("li");
		li.className = "note-item";

		const a = document.createElement("a");
		a.href = "#"; // Prevent default jump
		a.className = "note-link";
		a.textContent = title;

		a.addEventListener("click", (e) => {
			e.preventDefault();
			chrome.tabs.create({
				url: `${chrome.runtime.getURL("newtab.html")}#${note.id}`,
			});
		});

		li.appendChild(a);
		notesFragment.appendChild(li);
	}

	listContainer.replaceChildren(notesFragment);
}

async function bootstrap() {
	const settings = await readSettings();
	if (settings.theme === "light" || settings.theme === "dark") {
		document.documentElement.setAttribute("data-theme", settings.theme);
	}

	try {
		renderNotes(await listRecentNotes(POPUP_RECENT_NOTES_LIMIT));
	} catch (_error) {
		const listContainer = document.getElementById(
			"note-list",
		) as HTMLUListElement;
		const emptyState = document.getElementById("empty-state") as HTMLDivElement;
		emptyState.textContent = "Error loading notes.";
		emptyState.hidden = false;
		listContainer.hidden = true;
	}

	// Storage events already carry the full notes map, so popup refreshes stay incremental without another read.
	subscribeToNotes((notes) => {
		renderNotes(
			selectRecentNotes(Object.values(notes), POPUP_RECENT_NOTES_LIMIT),
		);
	});

	const btnMore = document.getElementById("btn-more");
	btnMore?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL(LIST_PAGE_PATH) });
	});

	const btnOptions = document.getElementById("btn-options");
	btnOptions?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
	});
}

bootstrap().catch(console.error);
