import { listRecentNotes } from "../shared/notes";
import { resolveNoteTitle } from "../shared/note_title";
import { readSettings } from "../shared/storage";

async function bootstrap() {
	const settings = await readSettings();
	if (settings.theme === "light" || settings.theme === "dark") {
		document.documentElement.setAttribute("data-theme", settings.theme);
	}

	const listContainer = document.getElementById(
		"note-list",
	) as HTMLUListElement;
	const emptyState = document.getElementById("empty-state") as HTMLDivElement;

	try {
		const notes = await listRecentNotes(20);

		if (notes.length === 0) {
			emptyState.hidden = false;
			listContainer.hidden = true;
		} else {
			emptyState.hidden = true;
			listContainer.hidden = false;
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
	} catch (_error) {
		emptyState.textContent = "Error loading notes.";
		emptyState.hidden = false;
		listContainer.hidden = true;
	}

	const btnMore = document.getElementById("btn-more");
	btnMore?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("list/index.html") });
	});

	const btnOptions = document.getElementById("btn-options");
	btnOptions?.addEventListener("click", () => {
		chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
	});
}

bootstrap().catch(console.error);
