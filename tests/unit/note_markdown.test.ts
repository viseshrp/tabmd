import { describe, expect, it } from "vitest";
import {
	createNoteMarkdownFileName,
	parseNoteFromMarkdownFile,
	serializeNoteToMarkdownFile,
} from "../../entrypoints/shared/note_markdown";

describe("note markdown helpers", () => {
	it("serializes and parses note metadata through markdown frontmatter", () => {
		const serialized = serializeNoteToMarkdownFile({
			id: "note-1",
			title: "Manual title",
			content: "# Hello\n\nWorld",
			createdAt: 10,
			modifiedAt: 20,
		});

		const parsed = parseNoteFromMarkdownFile(serialized, 99);
		expect(parsed).toEqual({
			id: "note-1",
			title: "Manual title",
			content: "# Hello\n\nWorld",
			createdAt: 10,
			modifiedAt: 20,
		});
	});

	it("parses quoted frontmatter scalars and preserves markdown body exactly", () => {
		const parsed = parseNoteFromMarkdownFile(
			[
				"---",
				"tabmd-version: 1",
				'tabmd-id: "note-\\"quoted\\""',
				'tabmd-title: "Title with : colon and \\"quotes\\""',
				"tabmd-created-at: 101",
				"tabmd-modified-at: 202",
				"---",
				"",
				"# Heading",
				"",
				"- bullet",
				"```ts",
				'console.log("ok")',
				"```",
			].join("\n"),
			999,
		);

		expect(parsed).toEqual({
			id: 'note-"quoted"',
			title: 'Title with : colon and "quotes"',
			content: ['# Heading', '', '- bullet', '```ts', 'console.log("ok")', "```"].join(
				"\n",
			),
			createdAt: 101,
			modifiedAt: 202,
		});
	});

	it("falls back to a plain markdown note when frontmatter is missing", () => {
		const parsed = parseNoteFromMarkdownFile("# Plain note", 42);
		expect(parsed.content).toBe("# Plain note");
		expect(parsed.title).toBeNull();
		expect(parsed.createdAt).toBe(42);
		expect(parsed.modifiedAt).toBe(42);
		expect(parsed.id.length).toBeGreaterThan(0);
	});

	it("derives file names from note content when there is no manual title", () => {
		expect(
			createNoteMarkdownFileName(
				null,
				"# Heading\n\nBody",
				Date.UTC(2026, 2, 9, 13, 42, 14, 254),
			),
		).toBe("Heading-2026-03-09T13-42-14-254Z.md");
	});

	it("falls back safely on malformed or incomplete frontmatter metadata", () => {
		const malformed = parseNoteFromMarkdownFile(
			[
				"---",
				"tabmd-version: 1",
				'tabmd-id: "note-1"',
				"not-a-metadata-line",
				"---",
				"Recovered content",
			].join("\n"),
			99,
		);
		expect(malformed.id).toBe("note-1");
		expect(malformed.title).toBeNull();
		expect(malformed.createdAt).toBe(99);
		expect(malformed.modifiedAt).toBe(99);
		expect(malformed.content).toBe("Recovered content");

		const invalidJson = parseNoteFromMarkdownFile(
			[
				"---",
				"tabmd-version: 1",
				'tabmd-id: "note-1',
				'tabmd-title: "broken',
				"tabmd-created-at: nope",
				"tabmd-modified-at: nope",
				"---",
				"",
				"Broken metadata content",
			].join("\n"),
			123,
		);
		expect(invalidJson.id.length).toBeGreaterThan(0);
		expect(invalidJson.id).not.toBe("note-1");
		expect(invalidJson.title).toBeNull();
		expect(invalidJson.createdAt).toBe(123);
		expect(invalidJson.modifiedAt).toBe(123);
		expect(invalidJson.content).toBe("Broken metadata content");
	});

	it("falls back when the closing frontmatter delimiter is missing or the timestamp is invalid", () => {
		const unterminated = parseNoteFromMarkdownFile(
			["---", 'tabmd-id: "note-1"', "Unterminated metadata"].join("\n"),
			55,
		);
		expect(unterminated.content).toContain("Unterminated metadata");
		expect(unterminated.createdAt).toBe(55);

		const fileName = createNoteMarkdownFileName("Title", "Body", Number.NaN);
		expect(fileName).toMatch(/^Title-\d{4}-\d{2}-\d{2}T/);
		expect(fileName.endsWith(".md")).toBe(true);
	});
});
