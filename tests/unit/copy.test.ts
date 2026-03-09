// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyEditorText } from "../../entrypoints/newtab/copy";

type ClipboardStub = {
	writeText(text: string): Promise<void>;
};

describe("copy editor text", () => {
	let notifier: { notify(message: string): void };
	let originalClipboard: Clipboard | undefined;

	beforeEach(() => {
		notifier = { notify: vi.fn() };
		originalClipboard = navigator.clipboard;
	});

	afterEach(() => {
		if (originalClipboard) {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value: originalClipboard,
			});
			return;
		}

		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});
	});

	it("writes editor text to the clipboard and shows success feedback", async () => {
		const writeText = vi.fn(async (_text: string) => undefined);
		const clipboard: ClipboardStub = { writeText };
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: clipboard,
		});

		await expect(copyEditorText("# Heading", notifier)).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith("# Heading");
		expect(notifier.notify).toHaveBeenCalledWith("Note copied");
	});

	it("returns false when clipboard access is unavailable", async () => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: undefined,
		});

		await expect(copyEditorText("Body", notifier)).resolves.toBe(false);
		expect(notifier.notify).toHaveBeenCalledWith("Clipboard unavailable");
	});

	it("returns false when the browser rejects the clipboard write", async () => {
		const writeText = vi.fn(async (_text: string) => {
			throw new Error("denied");
		});
		const clipboard: ClipboardStub = { writeText };
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: clipboard,
		});

		await expect(copyEditorText("Body", notifier)).resolves.toBe(false);
		expect(notifier.notify).toHaveBeenCalledWith("Failed to copy note");
	});
});
