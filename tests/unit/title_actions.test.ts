// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateNoteTitle = vi.fn();
const getEditorContent = vi.fn(() => "# Derived title\nBody");

vi.mock("../../entrypoints/newtab/save", () => ({
	updateNoteTitle,
}));

vi.mock("../../entrypoints/newtab/editor", () => ({
	getEditorContent,
}));

describe("title actions", () => {
	beforeEach(() => {
		vi.resetModules();
		updateNoteTitle.mockReset();
		getEditorContent.mockReset();
		getEditorContent.mockReturnValue("# Derived title\nBody");
		document.body.innerHTML = `
      <h1 id="note-title-display"></h1>
      <input id="note-title-input" hidden />
    `;
	});

	it("syncs derived titles and saves manual overrides on blur", async () => {
		const { initTitleActions } = await import("../../entrypoints/newtab/title");
		const display = document.getElementById(
			"note-title-display",
		) as HTMLHeadingElement;
		const input = document.getElementById(
			"note-title-input",
		) as HTMLInputElement;

		initTitleActions(null, "# Heading\nBody");
		expect(display.textContent).toBe("Heading");

		display.click();
		expect(display.hidden).toBe(true);
		expect(input.hidden).toBe(false);

		input.value = "  Manual title  ";
		input.dispatchEvent(new FocusEvent("blur"));

		expect(updateNoteTitle).toHaveBeenCalledWith("Manual title");
		expect(display.hidden).toBe(false);
		expect(input.hidden).toBe(true);
		expect(display.textContent).toBe("Manual title");
	});

	it("preloads the visible derived title when editing an auto-titled note", async () => {
		const { initTitleActions } = await import("../../entrypoints/newtab/title");
		const display = document.getElementById(
			"note-title-display",
		) as HTMLHeadingElement;
		const input = document.getElementById(
			"note-title-input",
		) as HTMLInputElement;

		getEditorContent.mockReturnValue("# Derived title\nBody");
		initTitleActions(null, "# Derived title\nBody");

		display.click();

		expect(input.value).toBe("Derived title");
	});

	it("reverts the input to the initial title on escape", async () => {
		const { initTitleActions } = await import("../../entrypoints/newtab/title");
		const display = document.getElementById(
			"note-title-display",
		) as HTMLHeadingElement;
		const input = document.getElementById(
			"note-title-input",
		) as HTMLInputElement;

		initTitleActions("Initial title", "Body");
		display.click();
		input.value = "Committed title";
		input.dispatchEvent(new FocusEvent("blur"));

		updateNoteTitle.mockReset();

		display.click();
		input.value = "Changed";
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);

		expect(input.value).toBe("Committed title");
		expect(updateNoteTitle).toHaveBeenCalledWith("Committed title");
	});

	it("commits the title on enter and exits early when controls are missing", async () => {
		const { initTitleActions } = await import("../../entrypoints/newtab/title");
		const display = document.getElementById(
			"note-title-display",
		) as HTMLHeadingElement;
		const input = document.getElementById(
			"note-title-input",
		) as HTMLInputElement;

		initTitleActions("Initial title", "Body");
		display.click();
		input.value = "Enter title";
		input.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);

		expect(updateNoteTitle).toHaveBeenCalledWith("Enter title");

		document.body.innerHTML = "";
		expect(() => initTitleActions(null, "")).not.toThrow();
	});

	it("clears manual titles back to derived titles", async () => {
		const { initTitleActions } = await import("../../entrypoints/newtab/title");
		const display = document.getElementById(
			"note-title-display",
		) as HTMLHeadingElement;
		const input = document.getElementById(
			"note-title-input",
		) as HTMLInputElement;

		getEditorContent.mockReturnValue("# Derived again");
		initTitleActions("Manual title", "# Derived again");
		display.click();
		input.value = "   ";
		input.dispatchEvent(new FocusEvent("blur"));

		expect(updateNoteTitle).toHaveBeenCalledWith(null);
		expect(display.textContent).toBe("Derived again");
	});
});
