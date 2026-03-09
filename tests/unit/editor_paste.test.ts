// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const replaceSelection = vi.fn();

class MockEasyMDE {
	codemirror = {
		getCursor: () => this.cursor,
		getLine: (lineNumber: number) => this.currentValue.split("\n")[lineNumber] ?? "",
		getWrapperElement: () => this.wrapperElement,
		on: () => undefined,
		replaceSelection,
		somethingSelected: () => false,
	};

	private cursor = { line: 0, ch: 0 };
	private currentValue: string;
	private readonly wrapperElement: HTMLDivElement;

	constructor(options: { initialValue?: string }) {
		this.currentValue = options.initialValue ?? "";
		const lines = this.currentValue.split("\n");
		this.cursor = {
			line: lines.length - 1,
			ch: lines.at(-1)?.length ?? 0,
		};
		this.wrapperElement = document.createElement("div");

		const editorContainer = document.getElementById("editor-container");
		editorContainer?.appendChild(this.wrapperElement);
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

describe("editor fenced paste handling", () => {
	beforeEach(() => {
		vi.resetModules();
		replaceSelection.mockReset();
		document.body.innerHTML = `
      <button id="btn-focus" aria-label="Toggle Focus Mode"></button>
      <div id="editor-container">
        <textarea id="editor-textarea"></textarea>
      </div>
    `;
	});

	it("inserts a separating newline before a pasted fenced block when the caret sits on a closing fence", async () => {
		const { initEditor } = await import("../../entrypoints/newtab/editor");

		initEditor("```\nfirst block\n```");

		const editorWrapper = document.querySelector("#editor-container > div");
		if (!(editorWrapper instanceof HTMLDivElement)) {
			throw new Error("Expected the editor wrapper to exist.");
		}

		const pastedBlock = "```\nsecond block\n```";
		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: {
				getData: () => pastedBlock,
			},
		});

		editorWrapper.dispatchEvent(pasteEvent);

		expect(replaceSelection).toHaveBeenCalledWith(
			`\n${pastedBlock}`,
			"end",
			"paste",
		);
		expect(pasteEvent.defaultPrevented).toBe(true);
	});

	it("leaves normal paste behavior alone when the pasted text is not a fenced block", async () => {
		const { initEditor } = await import("../../entrypoints/newtab/editor");

		initEditor("```\nfirst block\n```");

		const editorWrapper = document.querySelector("#editor-container > div");
		if (!(editorWrapper instanceof HTMLDivElement)) {
			throw new Error("Expected the editor wrapper to exist.");
		}

		const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
		Object.defineProperty(pasteEvent, "clipboardData", {
			value: {
				getData: () => "plain text",
			},
		});

		editorWrapper.dispatchEvent(pasteEvent);

		expect(replaceSelection).not.toHaveBeenCalled();
		expect(pasteEvent.defaultPrevented).toBe(false);
	});
});
