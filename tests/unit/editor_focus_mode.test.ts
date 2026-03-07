// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFocus = vi.fn();
const mockRefresh = vi.fn();

class MockEasyMDE {
	static lastOptions: { initialValue?: string } | null = null;

	codemirror = {
		focus: mockFocus,
		refresh: mockRefresh,
	};

	private currentValue: string;

	constructor(options: { initialValue?: string }) {
		MockEasyMDE.lastOptions = options;
		this.currentValue = options.initialValue ?? "";
	}

	value(nextValue?: string): string | undefined {
		if (typeof nextValue === "string") {
			this.currentValue = nextValue;
			return;
		}

		return this.currentValue;
	}
}

vi.mock("easymde", () => ({
	default: MockEasyMDE,
}));

vi.mock("easymde/dist/easymde.min.css", () => ({}));

describe("editor focus mode helpers", () => {
	beforeEach(() => {
		vi.resetModules();
		mockFocus.mockReset();
		mockRefresh.mockReset();
		MockEasyMDE.lastOptions = null;
		document.body.className = "";
		document.body.innerHTML = `
      <button id="btn-focus" aria-label="Toggle Focus Mode"></button>
      <div id="editor-container">
        <textarea id="editor-textarea"></textarea>
      </div>
    `;
	});

	it("initializes the editor with the provided content", async () => {
		const { getEditorContent, initEditor } = await import(
			"../../entrypoints/newtab/editor"
		);

		initEditor("# Draft");

		expect(MockEasyMDE.lastOptions?.initialValue).toBe("# Draft");
		expect(getEditorContent()).toBe("# Draft");
	});

	it("moves the visible editor into focus mode and updates the toggle state", async () => {
		const { initEditor, toggleFocusMode } = await import(
			"../../entrypoints/newtab/editor"
		);
		const focusButton = document.getElementById(
			"btn-focus",
		) as HTMLButtonElement;

		initEditor("Body");
		const isActive = toggleFocusMode();

		expect(isActive).toBe(true);
		expect(document.body.classList.contains("focus-mode-active")).toBe(true);
		expect(focusButton.getAttribute("aria-pressed")).toBe("true");
		expect(focusButton.title).toBe("Exit Focus Mode");
		expect(mockRefresh).toHaveBeenCalledTimes(1);
		expect(mockFocus).toHaveBeenCalledTimes(1);

		toggleFocusMode();
	});

	it("exits focus mode on Escape without timers or polling", async () => {
		const { initEditor, toggleFocusMode } = await import(
			"../../entrypoints/newtab/editor"
		);
		const focusButton = document.getElementById(
			"btn-focus",
		) as HTMLButtonElement;

		initEditor("Body");
		toggleFocusMode();
		document.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);

		expect(document.body.classList.contains("focus-mode-active")).toBe(false);
		expect(focusButton.getAttribute("aria-pressed")).toBe("false");
		expect(focusButton.title).toBe("Focus Mode");
		expect(mockRefresh).toHaveBeenCalledTimes(2);
	});

	it("refreshes the editor when the hidden editor view becomes visible again", async () => {
		const { hideEditor, initEditor, showEditor } = await import(
			"../../entrypoints/newtab/editor"
		);
		const editorContainer = document.getElementById(
			"editor-container",
		) as HTMLDivElement;

		initEditor("Body");
		mockRefresh.mockReset();

		hideEditor();
		showEditor();

		expect(editorContainer.hidden).toBe(false);
		expect(mockRefresh).toHaveBeenCalledTimes(1);
	});
});
