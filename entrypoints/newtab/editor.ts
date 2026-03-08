import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";
import { renderPreview } from "./preview";

const FOCUS_MODE_CLASS = "focus-mode-active";
const PREVIEW_ACTIVE_CLASS = "editor-preview-active";
const PREVIEW_MODE_CLASS = "tabmd-preview-mode";
const PREVIEW_SURFACE_CLASS = "editor-preview-full";
const PREVIEW_CLASS_NAMES = ["markdown-body", "tabmd-preview"] as const;

let editorInstance: EasyMDE | null = null;
let container: HTMLElement | null = null;
let focusModeActive = false;
let escapeHandlerRegistered = false;
const contentChangeListeners = new Set<(content: string) => void>();
let applyingExternalContent = false;

function syncFocusModeUi(isActive: boolean): void {
	document.body.classList.toggle(FOCUS_MODE_CLASS, isActive);

	const focusButton = document.getElementById("btn-focus");
	if (!(focusButton instanceof HTMLButtonElement)) {
		return;
	}

	focusButton.classList.toggle("active", isActive);
	focusButton.setAttribute("aria-pressed", String(isActive));
	focusButton.setAttribute(
		"title",
		isActive ? "Exit Focus Mode" : "Focus Mode",
	);
	focusButton.setAttribute(
		"aria-label",
		isActive ? "Exit Focus Mode" : "Toggle Focus Mode",
	);
}

function registerEscapeHandler(): void {
	if (escapeHandlerRegistered) {
		return;
	}

	// Focus mode hides the surrounding controls, so Escape must always provide a direct exit path.
	document.addEventListener("keydown", (event: KeyboardEvent) => {
		if (event.key !== "Escape" || !focusModeActive) {
			return;
		}

		event.preventDefault();
		setFocusMode(false);
	});

	escapeHandlerRegistered = true;
}

function getPreviewElement(): HTMLElement | null {
	if (!editorInstance) {
		return null;
	}

	const previewElement =
		editorInstance.codemirror.getWrapperElement().lastElementChild;
	if (
		!(previewElement instanceof HTMLElement) ||
		!previewElement.classList.contains(PREVIEW_SURFACE_CLASS)
	) {
		return null;
	}

	return previewElement;
}

function getEditorWrapper(): HTMLElement | null {
	return editorInstance?.codemirror.getWrapperElement() ?? null;
}

function getOrCreatePreviewElement(): HTMLElement | null {
	if (!editorInstance) {
		return null;
	}

	const existingPreview = getPreviewElement();
	if (existingPreview) {
		return existingPreview;
	}

	// EasyMDE's built-in preview toggle applies the active class on a timer. Creating the preview surface
	// ourselves keeps tab switches synchronous so Preview cannot re-activate after the user returns to Editor.
	const previewElement = document.createElement("div");
	previewElement.classList.add(PREVIEW_SURFACE_CLASS, ...PREVIEW_CLASS_NAMES);
	editorInstance.codemirror.getWrapperElement().append(previewElement);
	return previewElement;
}

function isPreviewActive(): boolean {
	return getPreviewElement()?.classList.contains(PREVIEW_ACTIVE_CLASS) ?? false;
}

function syncPreviewContent(): void {
	if (!editorInstance || !isPreviewActive()) {
		return;
	}

	const previewElement = getPreviewElement();
	if (!previewElement) {
		return;
	}

	// Repeated Preview clicks should refresh the same EasyMDE preview surface with the latest Markdown.
	previewElement.innerHTML = renderPreview(editorInstance.value());
}

function notifyContentChangeListeners(content: string): void {
	for (const listener of contentChangeListeners) {
		listener(content);
	}
}

export function initEditor(initialContent: string): EasyMDE {
	const textarea = document.getElementById("editor-textarea");
	if (!(textarea instanceof HTMLTextAreaElement)) {
		throw new Error("Expected #editor-textarea to be a textarea element.");
	}

	container = document.getElementById("editor-container");
	focusModeActive = false;
	syncFocusModeUi(false);
	registerEscapeHandler();

	editorInstance = new EasyMDE({
		element: textarea,
		initialValue: initialContent,
		autofocus: true,
		placeholder: "Start writing…",
		spellChecker: false,
		toolbar: false,
		status: false,
		previewClass: [...PREVIEW_CLASS_NAMES],
		previewRender: (markdownPlaintext: string) =>
			renderPreview(markdownPlaintext),
		shortcuts: {
			toggleFullScreen: null, // We trigger this manually via our own button
			togglePreview: null, // Preview state is owned by TabMD's explicit Editor/Preview tabs.
		},
	});

	// One shared change fanout keeps title derivation, save tracking, and preview refreshes in lockstep.
	editorInstance.codemirror.on("change", () => {
		if (applyingExternalContent) {
			return;
		}

		notifyContentChangeListeners(editorInstance?.value() ?? "");
	});

	return editorInstance;
}

export function getEditorContent(): string {
	if (!editorInstance) return "";
	return editorInstance.value();
}

/**
 * Applies a storage-driven editor update without treating it as a fresh local edit.
 * That prevents the new-tab page from echoing the same content back into storage in a loop.
 */
export function setEditorContent(nextContent: string): void {
	if (!editorInstance || editorInstance.value() === nextContent) {
		return;
	}

	applyingExternalContent = true;
	editorInstance.value(nextContent);
	applyingExternalContent = false;

	if (isPreviewActive()) {
		syncPreviewContent();
		return;
	}

	editorInstance.codemirror.refresh();
}

export function subscribeToEditorContentChanges(
	listener: (content: string) => void,
): () => void {
	contentChangeListeners.add(listener);

	return () => {
		contentChangeListeners.delete(listener);
	};
}

export function setFocusMode(nextActive: boolean): boolean {
	if (!editorInstance) {
		focusModeActive = false;
		syncFocusModeUi(false);
		return false;
	}

	if (focusModeActive === nextActive) {
		return focusModeActive;
	}

	// CodeMirror needs an immediate refresh after layout changes or it will keep stale dimensions.
	focusModeActive = nextActive;
	syncFocusModeUi(focusModeActive);
	editorInstance.codemirror.refresh();

	if (focusModeActive) {
		editorInstance.codemirror.focus();
	}

	return focusModeActive;
}

export function setPreviewMode(nextActive: boolean): boolean {
	if (!editorInstance) {
		return false;
	}

	const editorWrapper = getEditorWrapper();
	const previewElement = getOrCreatePreviewElement();
	if (!editorWrapper || !previewElement) {
		return false;
	}

	// The tab bar is stateful, so repeated clicks must be idempotent and still refresh live preview content.
	const previewActive = previewElement.classList.contains(PREVIEW_ACTIVE_CLASS);
	if (previewActive === nextActive) {
		if (nextActive) {
			syncPreviewContent();
		} else {
			editorInstance.codemirror.refresh();
		}

		return previewActive;
	}

	editorWrapper.classList.toggle(PREVIEW_MODE_CLASS, nextActive);
	previewElement.classList.toggle(PREVIEW_ACTIVE_CLASS, nextActive);
	if (nextActive) {
		previewElement.innerHTML = renderPreview(editorInstance.value());
		return true;
	}

	// Returning from Preview changes the editor width, so refresh before the user types again.
	editorInstance.codemirror.refresh();

	return false;
}

export function toggleFocusMode(): boolean {
	return setFocusMode(!focusModeActive);
}

export function hideEditor(): void {
	if (container) container.hidden = true;
}

export function showPreview(): void {
	if (container) {
		container.hidden = false;
	}

	setPreviewMode(true);
}

export function showEditor(): void {
	if (!container) {
		return;
	}

	container.hidden = false;
	if (isPreviewActive()) {
		setPreviewMode(false);
		return;
	}

	// Returning from a hidden state changes the editor width, so refresh before the user types again.
	editorInstance?.codemirror.refresh();
}
