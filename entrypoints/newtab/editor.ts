import EasyMDE from "easymde";
import "easymde/dist/easymde.min.css";

const FOCUS_MODE_CLASS = "focus-mode-active";

let editorInstance: EasyMDE | null = null;
let container: HTMLElement | null = null;
let focusModeActive = false;
let escapeHandlerRegistered = false;

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

export function initEditor(initialContent: string): EasyMDE {
	const textarea = document.getElementById(
		"editor-textarea",
	) as HTMLTextAreaElement;
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
		shortcuts: {
			toggleFullScreen: null, // We trigger this manually via our own button
		},
	});

	return editorInstance;
}

export function getEditorContent(): string {
	if (!editorInstance) return "";
	return editorInstance.value();
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

export function toggleFocusMode(): boolean {
	return setFocusMode(!focusModeActive);
}

export function hideEditor(): void {
	if (container) container.hidden = true;
}

export function showEditor(): void {
	if (!container) {
		return;
	}

	container.hidden = false;

	// Returning from Preview changes the editor width, so refresh before the user types again.
	editorInstance?.codemirror.refresh();
}
