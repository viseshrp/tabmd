// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";
import { flushMicrotasks } from "../helpers/flush";
import type { NoteRecord } from "../../entrypoints/shared/storage";

const initEditor = vi.fn();
const getEditorContent = vi.fn(() => "Editor body");
const hideEditor = vi.fn();
const showPreview = vi.fn();
const showEditor = vi.fn();
const setFocusMode = vi.fn();
const setEditorContent = vi.fn();
const subscribeToEditorContentChanges = vi.fn();
const toggleFocusMode = vi.fn();
const initSaveTracking = vi.fn();
const replaceTrackedNote = vi.fn();
const saveCurrentNote = vi.fn();
const applyTitleState = vi.fn();
const getCommittedTitle = vi.fn(() => null);
const initTitleActions = vi.fn();
const performExport = vi.fn();
const generateUUID = vi.fn(() => "generated-id");
const readNote = vi.fn();
const subscribeToNotes = vi.fn();
const readSettings = vi.fn(async () => ({ theme: "dark" as const }));

vi.mock("../../entrypoints/newtab/editor", () => ({
	initEditor,
	getEditorContent,
	hideEditor,
	showPreview,
	showEditor,
	setFocusMode,
	setEditorContent,
	subscribeToEditorContentChanges,
	toggleFocusMode,
}));

vi.mock("../../entrypoints/newtab/save", () => ({
	initSaveTracking,
	replaceTrackedNote,
	saveCurrentNote,
}));

vi.mock("../../entrypoints/newtab/title", () => ({
	applyTitleState,
	getCommittedTitle,
	initTitleActions,
}));

vi.mock("../../entrypoints/newtab/export", () => ({
	performExport,
}));

vi.mock("../../entrypoints/shared/uuid", () => ({
	generateUUID,
}));

vi.mock("../../entrypoints/shared/notes", () => ({
	readNote,
	subscribeToNotes,
}));

vi.mock("../../entrypoints/shared/storage", () => ({
	readSettings,
}));

describe("newtab entrypoint", () => {
	beforeEach(() => {
		vi.resetModules();
		initEditor.mockReset();
		getEditorContent.mockReset();
		getEditorContent.mockReturnValue("Editor body");
		hideEditor.mockReset();
		showPreview.mockReset();
		showEditor.mockReset();
		setFocusMode.mockReset();
		setEditorContent.mockReset();
		subscribeToEditorContentChanges.mockReset();
		toggleFocusMode.mockReset();
		initSaveTracking.mockReset();
		replaceTrackedNote.mockReset();
		saveCurrentNote.mockReset();
		applyTitleState.mockReset();
		getCommittedTitle.mockReset();
		getCommittedTitle.mockReturnValue(null);
		initTitleActions.mockReset();
		performExport.mockReset();
		generateUUID.mockReset();
		generateUUID.mockReturnValue("generated-id");
		readNote.mockReset();
		subscribeToNotes.mockReset();
		readSettings.mockReset();
		readSettings.mockResolvedValue({ theme: "dark" });

		document.body.innerHTML = `
      <button id="tab-editor" class="active"></button>
      <button id="tab-preview"></button>
      <button id="btn-focus"></button>
      <button id="btn-export"></button>
      <button id="btn-options"></button>
      <div id="editor-container"></div>
      <h1 id="note-title-display"></h1>
      <input id="note-title-input" hidden />
      <textarea id="editor-textarea"></textarea>
    `;

		window.history.replaceState(null, "", "/newtab.html");
		setMockChrome(createMockChrome());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("creates a new note when there is no hash and wires UI actions", async () => {
		readNote.mockResolvedValue(null);

		await import("../../entrypoints/newtab/index");
		await flushMicrotasks();

		expect(window.location.hash).toBe("#generated-id");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(initEditor).toHaveBeenCalledWith("");
		expect(initTitleActions).toHaveBeenCalledWith(null, "");
		expect(initSaveTracking).toHaveBeenCalledWith(
			expect.objectContaining({ id: "generated-id", content: "", title: null }),
		);
		expect(subscribeToEditorContentChanges).toHaveBeenCalledTimes(1);
		expect(subscribeToNotes).toHaveBeenCalledTimes(1);

		document
			.getElementById("tab-preview")
			?.dispatchEvent(new MouseEvent("click"));
		await flushMicrotasks();
		expect(
			document.getElementById("tab-preview")?.classList.contains("active"),
		).toBe(true);
		expect(
			document.getElementById("tab-editor")?.classList.contains("active"),
		).toBe(false);
		expect(setFocusMode).toHaveBeenCalledWith(false);
		expect(showPreview).toHaveBeenCalled();

		document
			.getElementById("btn-focus")
			?.dispatchEvent(new MouseEvent("click"));
		expect(showEditor).toHaveBeenCalled();
		expect(toggleFocusMode).toHaveBeenCalled();

		document
			.getElementById("tab-editor")
			?.dispatchEvent(new MouseEvent("click"));
		expect(
			document.getElementById("tab-editor")?.classList.contains("active"),
		).toBe(true);
		expect(
			document.getElementById("tab-preview")?.classList.contains("active"),
		).toBe(false);
		expect(showEditor).toHaveBeenCalled();

		document
			.getElementById("btn-export")
			?.dispatchEvent(new MouseEvent("click"));
		expect(performExport).toHaveBeenCalledWith(null, "Editor body");

		document
			.getElementById("btn-options")
			?.dispatchEvent(new MouseEvent("click"));
		const mockChrome = chrome as typeof globalThis.chrome & {
			__createdWindows: chrome.windows.CreateData[];
		};
		expect(mockChrome.__createdWindows.at(-1)).toEqual({
			url: "chrome-extension://mock/options.html",
			type: "normal",
			focused: true,
		});
	});

	it("loads an existing note from the hash when present", async () => {
		window.history.replaceState(null, "", "/newtab.html#existing-id");
		readNote.mockResolvedValue({
			id: "existing-id",
			content: "# Existing",
			title: "Saved title",
			createdAt: 1,
			modifiedAt: 2,
		});

		await import("../../entrypoints/newtab/index");
		await flushMicrotasks();

		expect(generateUUID).not.toHaveBeenCalled();
		expect(readNote).toHaveBeenCalledWith("existing-id");
		expect(initEditor).toHaveBeenCalledWith("# Existing");
		expect(initTitleActions).toHaveBeenCalledWith("Saved title", "# Existing");
	});

	it("treats an unknown hash as a new note with that id", async () => {
		window.history.replaceState(null, "", "/newtab.html#missing-id");
		readNote.mockResolvedValue(null);

		await import("../../entrypoints/newtab/index");
		await flushMicrotasks();

		expect(generateUUID).not.toHaveBeenCalled();
		expect(initEditor).toHaveBeenCalledWith("");
		expect(initSaveTracking).toHaveBeenCalledWith(
			expect.objectContaining({ id: "missing-id", content: "", title: null }),
		);
	});

	it("saves immediately on editor and title changes", async () => {
		readNote.mockResolvedValue(null);
		let handleEditorChange: ((content: string) => void) | undefined;
		subscribeToEditorContentChanges.mockImplementation((listener) => {
			handleEditorChange = listener;
			return () => undefined;
		});

		await import("../../entrypoints/newtab/index");
		await flushMicrotasks();

		handleEditorChange?.("# Live heading");
		expect(applyTitleState).toHaveBeenCalledWith(null, "# Live heading");
		expect(saveCurrentNote).toHaveBeenCalledTimes(1);

		document
			.getElementById("note-title-input")
			?.dispatchEvent(new FocusEvent("blur"));
		expect(saveCurrentNote).toHaveBeenCalledTimes(2);
	});

	it("applies storage-synced note updates to the active editor", async () => {
		window.history.replaceState(null, "", "/newtab.html#existing-id");
		readNote.mockResolvedValue({
			id: "existing-id",
			content: "# Existing",
			title: "Saved title",
			createdAt: 1,
			modifiedAt: 2,
		});
		let handleNotesChange:
			| ((notes: Record<string, NoteRecord>) => void)
			| undefined;
		subscribeToNotes.mockImplementation((listener) => {
			handleNotesChange = listener;
			return () => undefined;
		});

		await import("../../entrypoints/newtab/index");
		await flushMicrotasks();

		handleNotesChange?.({
			other: {
				id: "other",
				content: "Ignore me",
				title: "Other",
				createdAt: 1,
				modifiedAt: 3,
			},
		});
		expect(replaceTrackedNote).not.toHaveBeenCalled();
		expect(setEditorContent).not.toHaveBeenCalled();

		handleNotesChange?.({
			"existing-id": {
				id: "existing-id",
				content: "# Synced",
				title: "Synced title",
				createdAt: 1,
				modifiedAt: 3,
			},
		});

		expect(replaceTrackedNote).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "existing-id",
				content: "# Synced",
				title: "Synced title",
			}),
		);
		expect(applyTitleState).toHaveBeenCalledWith("Synced title", "# Synced");
		expect(setEditorContent).toHaveBeenCalledWith("# Synced");
	});
});
