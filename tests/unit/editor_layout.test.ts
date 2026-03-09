// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFocus = vi.fn();
const mockRefresh = vi.fn();

class MockEasyMDE {
	static lastInstance: MockEasyMDE | null = null;

	codemirror = {
		focus: mockFocus,
		getWrapperElement: () => this.wrapperElement,
		on: () => undefined,
		refresh: mockRefresh,
	};

	private readonly previewElement: HTMLDivElement;
	private readonly wrapperElement: HTMLDivElement;

	constructor(private readonly options: {
		previewClass?: string | readonly string[];
		previewRender?: (markdownPlaintext: string) => string | null;
	}) {
		MockEasyMDE.lastInstance = this;
		this.wrapperElement = document.createElement("div");
		this.wrapperElement.className = "EasyMDEContainer";
		this.wrapperElement.appendChild(document.createElement("div"));
		this.previewElement = document.createElement("div");
		this.previewElement.className = "editor-preview-full";
		const previewClasses = Array.isArray(options.previewClass)
			? options.previewClass
			: options.previewClass
				? [options.previewClass]
				: [];
		this.previewElement.classList.add(...previewClasses);
		this.wrapperElement.appendChild(this.previewElement);

		const editorContainer = document.getElementById("editor-container");
		editorContainer?.appendChild(this.wrapperElement);
	}

	value(): string {
		return "# Layout";
	}

	renderPreview(): void {
		this.previewElement.innerHTML = this.options.previewRender?.("# Layout") ?? "";
	}
}

vi.mock("easymde", () => ({
	default: MockEasyMDE,
}));

vi.mock("easymde/dist/easymde.min.css", () => ({}));

describe("editor layout bootstrap", () => {
	beforeEach(() => {
		vi.resetModules();
		mockFocus.mockReset();
		mockRefresh.mockReset();
		MockEasyMDE.lastInstance = null;
		document.body.innerHTML = `
      <button id="btn-focus" aria-label="Toggle Focus Mode"></button>
      <div id="editor-container">
        <textarea id="editor-textarea"></textarea>
      </div>
    `;
	});

	it("mounts the EasyMDE wrapper into the editor container so CSS can stretch the workspace", async () => {
		const { initEditor } = await import("../../entrypoints/newtab/editor");

		initEditor("# Layout");

		const editorContainer = document.getElementById("editor-container");
		const editorWrapper = editorContainer?.querySelector(".EasyMDEContainer");

		expect(editorWrapper).not.toBeNull();
		expect(editorWrapper?.parentElement).toBe(editorContainer);
	});

	it("keeps the preview surface attached to the EasyMDE wrapper when preview mode is active", async () => {
		const { initEditor, showPreview } = await import("../../entrypoints/newtab/editor");

		initEditor("# Layout");
		showPreview();

		const previewElement = document.querySelector(".editor-preview-full");
		expect(previewElement).not.toBeNull();
		expect(previewElement?.parentElement?.classList.contains("EasyMDEContainer")).toBe(true);
		expect(previewElement?.classList.contains("editor-preview-active")).toBe(true);
		expect(previewElement?.classList.contains("tabmd-preview")).toBe(true);
		expect(previewElement?.classList.contains("markdown-body")).toBe(true);
	});
});
