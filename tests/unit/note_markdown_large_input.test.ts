import { describe, expect, it } from "vitest";
import { parseNoteFromMarkdownFile } from "../../entrypoints/shared/note_markdown";

describe("note markdown helpers with large inputs", () => {
	it("preserves a large CRLF note body without splitting the entire file into lines", () => {
		const largeBody = [
			"# Large Heading",
			"",
			...Array.from({ length: 4_000 }, (_, index) => `line-${index}: value`),
			"",
			"```unknown",
			...Array.from({ length: 2_000 }, (_, index) => `code-${index}`),
			"```",
		].join("\r\n");
		const markdownFile = [
			"---",
			"tabmd-version: 1",
			'tabmd-id: "large-note"',
			"tabmd-title: null",
			"tabmd-created-at: 101",
			"tabmd-modified-at: 202",
			"---",
			"",
			largeBody,
		].join("\r\n");

		const parsed = parseNoteFromMarkdownFile(markdownFile, 999);

		expect(parsed).toEqual({
			id: "large-note",
			title: null,
			content: largeBody,
			createdAt: 101,
			modifiedAt: 202,
		});
	});

	it("treats a large markdown file without frontmatter as a plain note", () => {
		const plainMarkdown = `# Plain note\n${"body line\n".repeat(8_000)}`;

		const parsed = parseNoteFromMarkdownFile(plainMarkdown, 77);

		expect(parsed.title).toBeNull();
		expect(parsed.content).toBe(plainMarkdown);
		expect(parsed.createdAt).toBe(77);
		expect(parsed.modifiedAt).toBe(77);
		expect(parsed.id.length).toBeGreaterThan(0);
	});
});
