export function resolveNoteTitle(note: {
	title: string | null;
	content: string;
}): string {
	if (note.title && note.title.trim().length > 0) {
		return note.title.trim();
	}

	// Only the first line contributes to the derived title, so avoid splitting the entire note body.
	const firstNewlineIndex = note.content.indexOf("\n");
	const firstLine =
		firstNewlineIndex === -1
			? note.content
			: note.content.slice(0, firstNewlineIndex);

	// Strip leading '#' characters and whitespace
	const stripped = firstLine.replace(/^[#\s]+/, "").trim();

	if (stripped.length > 0) {
		return stripped;
	}

	return "Untitled";
}
