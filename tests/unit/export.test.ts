// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { performExport } from "../../entrypoints/newtab/export";

// Mocking the DOM objects
type MockBlobPart = BlobPart;
type MockBlobOptions = BlobPropertyBag | undefined;
type MockAnchor = HTMLAnchorElement & { click: () => void };

class MockBlob {
	constructor(
		public content: MockBlobPart[],
		public options?: MockBlobOptions,
	) {}
}

global.Blob = MockBlob as unknown as typeof Blob;

global.URL = {
	createObjectURL: () => "blob:test",
	revokeObjectURL: () => {},
} as unknown as typeof URL;

describe("export", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates an anchor with sanitized title", () => {
		vi.spyOn(Date, "now").mockReturnValue(
			Date.UTC(2026, 2, 9, 13, 42, 14, 254),
		);
		const originalCreateElement = document.createElement.bind(document);
		let appendedChild: MockAnchor | null = null;
		let clicked = false;

		document.createElement = (tag: string) => {
			const el = originalCreateElement(tag);
			if (tag === "a") {
				(el as MockAnchor).click = () => {
					clicked = true;
				};
			}
			return el;
		};

		const originalAppend = document.body.appendChild.bind(document.body);
		document.body.appendChild = <T extends Node>(child: T) => {
			appendedChild = child as unknown as MockAnchor;
			return child;
		};

		const originalRemove = document.body.removeChild.bind(document.body);
		document.body.removeChild = <T extends Node>(child: T) => child;

		performExport("Test/Title:*?", "Content");

		expect(appendedChild).not.toBeNull();
		if (!appendedChild) {
			throw new Error("Expected export to append an anchor element");
		}

		const anchor: HTMLAnchorElement = appendedChild;
		expect(anchor.download).toBe("Test-Title----2026-03-09T13-42-14-254Z.md");
		expect(clicked).toBe(true);

		// Restore
		document.createElement = originalCreateElement;
		document.body.appendChild = originalAppend;
		document.body.removeChild = originalRemove;
	});

	it("falls back to Untitled when there is no derived title", () => {
		vi.spyOn(Date, "now").mockReturnValue(
			Date.UTC(2026, 2, 9, 13, 42, 14, 254),
		);
		const originalCreateElement = document.createElement.bind(document);
		let appendedChild: HTMLAnchorElement | null = null;

		document.createElement = (tag: string) => originalCreateElement(tag);

		const originalAppend = document.body.appendChild.bind(document.body);
		document.body.appendChild = <T extends Node>(child: T) => {
			appendedChild = child as unknown as HTMLAnchorElement;
			return child;
		};

		const originalRemove = document.body.removeChild.bind(document.body);
		document.body.removeChild = <T extends Node>(child: T) => child;

		performExport(null, "");

		if (!appendedChild) {
			throw new Error("Expected export to append an anchor element");
		}

		const anchor: HTMLAnchorElement = appendedChild;
		expect(anchor.download).toBe("Untitled-2026-03-09T13-42-14-254Z.md");

		document.createElement = originalCreateElement;
		document.body.appendChild = originalAppend;
		document.body.removeChild = originalRemove;
	});
});
