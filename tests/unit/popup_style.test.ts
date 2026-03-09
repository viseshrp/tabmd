import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const popupStylesheetPath = new URL(
	"../../entrypoints/popup/style.css",
	import.meta.url,
);
const popupStylesheet = readFileSync(popupStylesheetPath, "utf8");

describe("popup stylesheet", () => {
	it("keeps recent-note rows width-bound so long titles truncate instead of creating horizontal scrolling", () => {
		// These selectors work together: the list hides any accidental horizontal bleed,
		// the grid item is allowed to shrink, and the link sizes itself with border-box so ellipsis is based on the real row width.
		expect(popupStylesheet).toContain(".note-list {");
		expect(popupStylesheet).toContain("overflow-x: hidden;");
		expect(popupStylesheet).toContain(".note-item {");
		expect(popupStylesheet).toContain("min-width: 0;");
		expect(popupStylesheet).toContain(".note-link {");
		expect(popupStylesheet).toContain("max-width: 100%;");
		expect(popupStylesheet).toContain("box-sizing: border-box;");
		expect(popupStylesheet).toContain("text-overflow: ellipsis;");
	});
});
