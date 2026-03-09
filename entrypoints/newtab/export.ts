import { createNoteMarkdownFileName } from "../shared/note_markdown";

/** Exports one note as Markdown using the shared title-plus-timestamp file naming convention. */
export function performExport(noteTitle: string | null, content: string) {
	const filename = createNoteMarkdownFileName(noteTitle, content, Date.now());

	const blob = new Blob([content], { type: "text/markdown" });
	const objectUrl = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename;

	document.body.appendChild(a);
	a.click();

	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}
