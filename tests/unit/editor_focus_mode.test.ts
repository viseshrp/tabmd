// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFocus = vi.fn();
const mockRefresh = vi.fn();

class MockEasyMDE {
	static lastOptions: {
		initialValue?: string;
		previewClass?: string | readonly string[];
		previewRender?: (markdownPlaintext: string) => string | null;
	} | null = null;

	codemirror = {
		focus: mockFocus,
		getWrapperElement: () => this.wrapperElement,
		on: (eventName: string, handler: () => void) => {
			if (eventName === "change") {
				this.changeListeners.add(handler);
			}
		},
		refresh: mockRefresh,
	};

	private readonly changeListeners = new Set<() => void>();
	private currentValue: string;
	private readonly previewElement: HTMLDivElement;
	private readonly wrapperElement: HTMLDivElement;

	constructor(
		private readonly options: {
			initialValue?: string;
			previewClass?: string | readonly string[];
			previewRender?: (markdownPlaintext: string) => string | null;
		},
	) {
		MockEasyMDE.lastOptions = options;
		this.currentValue = options.initialValue ?? "";
		this.wrapperElement = document.createElement("div");
		this.previewElement = document.createElement("div");
		this.previewElement.className = "editor-preview-full";
		this.wrapperElement.appendChild(document.createElement("div"));
		this.wrapperElement.appendChild(this.previewElement);

		// EasyMDE replaces the textarea in-place, so the preview wrapper must live in the document for DOM queries.
		const editorContainer = document.getElementById("editor-container");
		editorContainer?.appendChild(this.wrapperElement);
	}

	value(nextValue?: string): string | undefined {
		if (typeof nextValue === "string") {
			this.currentValue = nextValue;
			for (const listener of this.changeListeners) {
				listener();
			}
			return;
		}

		return this.currentValue;
	}

	isPreviewActive(): boolean {
		return this.previewElement.classList.contains("editor-preview-active");
	}

	static togglePreview(editor: MockEasyMDE): void {
		const previewActive = !editor.previewElement.classList.contains(
			"editor-preview-active",
		);
		editor.previewElement.classList.toggle(
			"editor-preview-active",
			previewActive,
		);

		if (!previewActive || !editor.options.previewRender) {
			return;
		}

		editor.previewElement.innerHTML =
			editor.options.previewRender(editor.currentValue) ?? "";
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
		expect(MockEasyMDE.lastOptions?.previewClass).toEqual([
			"markdown-body",
			"tabmd-preview",
		]);
		expect(getEditorContent()).toBe("# Draft");
	});

	it("moves the visible editor into focus mode and updates the toggle state", async () => {
		const { initEditor, toggleFocusMode } = await import(
			"../../entrypoints/newtab/editor"
		);
		const focusButton = document.getElementById("btn-focus");
		if (!(focusButton instanceof HTMLButtonElement)) {
			throw new Error("Expected #btn-focus to be a button.");
		}

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
		const focusButton = document.getElementById("btn-focus");
		if (!(focusButton instanceof HTMLButtonElement)) {
			throw new Error("Expected #btn-focus to be a button.");
		}

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
		const editorContainer = document.getElementById("editor-container");
		if (!(editorContainer instanceof HTMLDivElement)) {
			throw new Error("Expected #editor-container to be a div.");
		}

		initEditor("Body");
		mockRefresh.mockReset();

		hideEditor();
		showEditor();

		expect(editorContainer.hidden).toBe(false);
		expect(mockRefresh).toHaveBeenCalledTimes(1);
	});

	it("routes preview through EasyMDE and refreshes repeated preview clicks", async () => {
		const { initEditor, showPreview } = await import(
			"../../entrypoints/newtab/editor"
		);

		initEditor("# First");
		showPreview();

		const previewElement = document.querySelector(".editor-preview-active");
		if (!(previewElement instanceof HTMLDivElement)) {
			throw new Error("Expected EasyMDE preview to be a div.");
		}
		expect(previewElement.innerHTML).toContain("<h1>First</h1>");

		previewElement.innerHTML = "<p>stale</p>";
		showPreview();

		expect(previewElement.innerHTML).toContain("<h1>First</h1>");
	});

	it("removes the preview overlay as soon as the editor tab becomes active again", async () => {
		const { initEditor, showEditor, showPreview } = await import(
			"../../entrypoints/newtab/editor"
		);

		initEditor("# Draft");
		showPreview();
		mockRefresh.mockReset();

		showEditor();

		const previewElement = document.querySelector(".editor-preview-full");
		if (!(previewElement instanceof HTMLDivElement)) {
			throw new Error("Expected EasyMDE preview to be a div.");
		}

		expect(previewElement.classList.contains("editor-preview-active")).toBe(
			false,
		);
		expect(mockRefresh).toHaveBeenCalledTimes(1);
	});

	it("notifies editor change listeners for local edits but not storage-driven updates", async () => {
		const { initEditor, setEditorContent, subscribeToEditorContentChanges } =
			await import("../../entrypoints/newtab/editor");
		const contentListener = vi.fn();

		const editor = initEditor("Initial");
		subscribeToEditorContentChanges(contentListener);

		setEditorContent("Synced from storage");
		expect(contentListener).not.toHaveBeenCalled();

		editor.value("Typed locally");

		expect(contentListener).toHaveBeenCalledWith("Typed locally");
	});
});
