// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteRecord } from "../../entrypoints/shared/storage";
import { flushMicrotasks } from "../helpers/flush";

const getEditorContent = vi.fn();
const writeNote = vi.fn();
const logExtensionError = vi.fn();

vi.mock("../../entrypoints/newtab/editor", () => ({
	getEditorContent,
}));

vi.mock("../../entrypoints/shared/notes", () => ({
	writeNote,
}));

vi.mock("../../entrypoints/shared/utils", () => ({
	logExtensionError,
}));

function makeNote(): NoteRecord {
	return {
		id: "note-1",
		content: "Initial",
		title: null,
		createdAt: 1,
		modifiedAt: 1,
	};
}

function captureVisibilityHandler() {
	let visibilityHandler: EventListener | undefined;
	vi.spyOn(document, "addEventListener").mockImplementation(
		(
			type: string,
			handler: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		) => {
			if (type === "visibilitychange" && typeof handler === "function") {
				visibilityHandler = handler;
			}
			return EventTarget.prototype.addEventListener.call(
				document,
				type,
				handler,
				options,
			);
		},
	);
	return () => visibilityHandler?.(new Event("visibilitychange"));
}

function createDeferred<T>() {
	let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
	const promise = new Promise<T>((nextResolve) => {
		resolve = nextResolve;
	});

	return {
		promise,
		resolve: (value: T) => resolve?.(value),
	};
}

describe("save tracking", () => {
	beforeEach(() => {
		vi.resetModules();
		getEditorContent.mockReset();
		writeNote.mockReset();
		logExtensionError.mockReset();
		document.body.innerHTML = "";
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "visible",
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("writes updated content on visibility change", async () => {
		const runVisibilityHandler = captureVisibilityHandler();

		const { initSaveTracking, updateNoteTitle } = await import(
			"../../entrypoints/newtab/save"
		);
		const note = makeNote();
		getEditorContent.mockReturnValue("Updated");

		initSaveTracking(note);
		updateNoteTitle("Manual");
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		runVisibilityHandler();
		await flushMicrotasks();

		expect(writeNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "note-1",
				content: "Updated",
				title: "Manual",
			}),
		);
	});

	it("skips writes when content and title are unchanged", async () => {
		const runVisibilityHandler = captureVisibilityHandler();

		const { initSaveTracking } = await import("../../entrypoints/newtab/save");
		const note = makeNote();
		getEditorContent.mockReturnValue("Initial");

		initSaveTracking(note);
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		runVisibilityHandler();
		await flushMicrotasks();

		expect(writeNote).not.toHaveBeenCalled();
	});

	it("writes when only the title changes", async () => {
		const runVisibilityHandler = captureVisibilityHandler();

		const { initSaveTracking, updateNoteTitle } = await import(
			"../../entrypoints/newtab/save"
		);
		getEditorContent.mockReturnValue("Initial");

		initSaveTracking(makeNote());
		updateNoteTitle("Renamed");
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		runVisibilityHandler();
		await flushMicrotasks();

		expect(writeNote).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "Initial",
				title: "Renamed",
			}),
		);
	});

	it("logs save failures", async () => {
		const runVisibilityHandler = captureVisibilityHandler();

		const { initSaveTracking } = await import("../../entrypoints/newtab/save");
		const note = makeNote();
		getEditorContent.mockReturnValue("Updated");
		writeNote.mockRejectedValue(new Error("save failed"));

		initSaveTracking(note);
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => "hidden",
		});
		runVisibilityHandler();
		await flushMicrotasks();

		expect(logExtensionError).toHaveBeenCalledWith(
			"Failed to save note during real-time sync",
			expect.any(Error),
			"save_logic",
		);
	});

	it("saves on beforeunload", async () => {
		let beforeUnloadHandler: EventListener | undefined;
		vi.spyOn(window, "addEventListener").mockImplementation(
			(
				type: string,
				handler: EventListenerOrEventListenerObject,
				_options?: boolean | AddEventListenerOptions,
			) => {
				if (type === "beforeunload" && typeof handler === "function") {
					beforeUnloadHandler = handler;
				}
			},
		);

		const { initSaveTracking } = await import("../../entrypoints/newtab/save");
		getEditorContent.mockReturnValue("Unload content");
		initSaveTracking(makeNote());

		beforeUnloadHandler?.(new Event("beforeunload"));
		await flushMicrotasks();

		expect(writeNote).toHaveBeenCalledWith(
			expect.objectContaining({ content: "Unload content" }),
		);
	});

	it("exposes an immediate save entrypoint for real-time sync", async () => {
		const { initSaveTracking, saveCurrentNote, updateNoteTitle } = await import(
			"../../entrypoints/newtab/save"
		);
		getEditorContent.mockReturnValue("Live update");

		initSaveTracking(makeNote());
		updateNoteTitle("Live title");
		await saveCurrentNote();

		expect(writeNote).toHaveBeenCalledWith(
			expect.objectContaining({
				content: "Live update",
				title: "Live title",
			}),
		);
	});

	it("accepts storage-synced notes as the new saved baseline", async () => {
		const { initSaveTracking, replaceTrackedNote, saveCurrentNote } =
			await import("../../entrypoints/newtab/save");
		getEditorContent.mockReturnValue("Remote content");

		initSaveTracking(makeNote());
		replaceTrackedNote({
			...makeNote(),
			content: "Remote content",
			title: "Remote title",
			modifiedAt: 5,
		});

		await saveCurrentNote();

		expect(writeNote).not.toHaveBeenCalled();
	});

	it("registers lifecycle listeners only once after the first initialization", async () => {
		const documentListenerSpy = vi.spyOn(document, "addEventListener");
		const windowListenerSpy = vi.spyOn(window, "addEventListener");
		const { initSaveTracking } = await import("../../entrypoints/newtab/save");

		initSaveTracking(makeNote());
		initSaveTracking({
			...makeNote(),
			id: "note-2",
		});

		expect(
			documentListenerSpy.mock.calls.filter(
				([eventName]) => eventName === "visibilitychange",
			),
		).toHaveLength(1);
		expect(
			windowListenerSpy.mock.calls.filter(
				([eventName]) => eventName === "beforeunload",
			),
		).toHaveLength(1);
	});

	it("reuses the active save promise while persistence is already in flight", async () => {
		const writeDeferred = createDeferred<void>();
		const { initSaveTracking, saveCurrentNote } = await import(
			"../../entrypoints/newtab/save"
		);

		getEditorContent.mockReturnValue("Updated");
		writeNote.mockReturnValue(writeDeferred.promise);
		initSaveTracking(makeNote());

		const firstSave = saveCurrentNote();
		const secondSave = saveCurrentNote();
		expect(secondSave).toBe(firstSave);

		writeDeferred.resolve();
		await firstSave;

		expect(writeNote).toHaveBeenCalledTimes(1);
	});
});
