import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const newtabStylesheetPath = new URL(
	"../../entrypoints/newtab/style.css",
	import.meta.url,
);
const newtabStylesheet = readFileSync(newtabStylesheetPath, "utf8");

describe("newtab stylesheet", () => {
	it("keeps preview mode on a single scroll surface instead of exposing the hidden editor scrollbar", () => {
		// The preview overlay stays hidden until preview mode is active, then the CodeMirror wrapper
		// and its internal scroller are both prevented from advertising their own scrollbars.
		expect(newtabStylesheet).toContain(
			".EasyMDEContainer .editor-preview-full {",
		);
		expect(newtabStylesheet).toContain("display: none;");
		expect(newtabStylesheet).toContain(
			".EasyMDEContainer .editor-preview-full.editor-preview-active {",
		);
		expect(newtabStylesheet).toContain("display: block;");
		expect(newtabStylesheet).toContain(
			".EasyMDEContainer .CodeMirror.tabmd-preview-mode {",
		);
		expect(newtabStylesheet).toContain("overflow: hidden;");
		expect(newtabStylesheet).toContain("padding: 0;");
		expect(newtabStylesheet).toContain(
			".EasyMDEContainer .CodeMirror.tabmd-preview-mode .CodeMirror-scroll {",
		);
		expect(newtabStylesheet).toContain("overflow: hidden !important;");
	});
});
