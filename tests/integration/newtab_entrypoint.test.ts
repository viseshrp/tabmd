// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockChrome, setMockChrome } from '../helpers/mock_chrome';

const initEditor = vi.fn();
const getEditorContent = vi.fn(() => 'Editor body');
const hideEditor = vi.fn();
const showEditor = vi.fn();
const toggleFocusMode = vi.fn();
const initSaveTracking = vi.fn();
const initTitleActions = vi.fn();
const renderPreview = vi.fn(async () => '<p>preview</p>');
const showPreviewContainer = vi.fn();
const hidePreviewContainer = vi.fn();
const performExport = vi.fn();
const generateUUID = vi.fn(() => 'generated-id');
const readNote = vi.fn();
const readSettings = vi.fn(async () => ({ theme: 'dark' as const }));

vi.mock('../../entrypoints/newtab/editor', () => ({
  initEditor,
  getEditorContent,
  hideEditor,
  showEditor,
  toggleFocusMode
}));

vi.mock('../../entrypoints/newtab/save', () => ({
  initSaveTracking
}));

vi.mock('../../entrypoints/newtab/title', () => ({
  initTitleActions
}));

vi.mock('../../entrypoints/newtab/preview', () => ({
  renderPreview,
  showPreviewContainer,
  hidePreviewContainer
}));

vi.mock('../../entrypoints/newtab/export', () => ({
  performExport
}));

vi.mock('../../entrypoints/shared/uuid', () => ({
  generateUUID
}));

vi.mock('../../entrypoints/shared/notes', () => ({
  readNote
}));

vi.mock('../../entrypoints/shared/storage', () => ({
  readSettings
}));

describe('newtab entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    initEditor.mockReset();
    getEditorContent.mockReset();
    getEditorContent.mockReturnValue('Editor body');
    hideEditor.mockReset();
    showEditor.mockReset();
    toggleFocusMode.mockReset();
    initSaveTracking.mockReset();
    initTitleActions.mockReset();
    renderPreview.mockReset();
    renderPreview.mockResolvedValue('<p>preview</p>');
    showPreviewContainer.mockReset();
    hidePreviewContainer.mockReset();
    performExport.mockReset();
    generateUUID.mockReset();
    generateUUID.mockReturnValue('generated-id');
    readNote.mockReset();
    readSettings.mockReset();
    readSettings.mockResolvedValue({ theme: 'dark' });

    document.body.innerHTML = `
      <button id="tab-editor" class="active"></button>
      <button id="tab-preview"></button>
      <button id="btn-focus"></button>
      <button id="btn-export"></button>
      <button id="btn-options"></button>
      <div id="editor-container"></div>
      <div id="preview-container" hidden></div>
      <h1 id="note-title-display"></h1>
      <input id="note-title-input" hidden />
      <textarea id="editor-textarea"></textarea>
    `;

    window.history.replaceState(null, '', '/newtab.html');
    setMockChrome(createMockChrome());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a new note when there is no hash and wires UI actions', async () => {
    readNote.mockResolvedValue(null);

    await import('../../entrypoints/newtab/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.hash).toBe('#generated-id');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(initEditor).toHaveBeenCalledWith('');
    expect(initTitleActions).toHaveBeenCalledWith(null, '');
    expect(initSaveTracking).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'generated-id', content: '', title: null })
    );

    document.getElementById('tab-preview')?.dispatchEvent(new MouseEvent('click'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(hideEditor).toHaveBeenCalled();
    expect(renderPreview).toHaveBeenCalledWith('Editor body');
    expect(showPreviewContainer).toHaveBeenCalledWith('<p>preview</p>');

    document.getElementById('tab-editor')?.dispatchEvent(new MouseEvent('click'));
    expect(hidePreviewContainer).toHaveBeenCalled();
    expect(showEditor).toHaveBeenCalled();

    document.getElementById('btn-focus')?.dispatchEvent(new MouseEvent('click'));
    expect(toggleFocusMode).toHaveBeenCalled();

    document.getElementById('btn-export')?.dispatchEvent(new MouseEvent('click'));
    expect(performExport).toHaveBeenCalledWith(null, 'Editor body');

    document.getElementById('btn-options')?.dispatchEvent(new MouseEvent('click'));
    const mockChrome = chrome as typeof globalThis.chrome & { __createdTabs: chrome.tabs.CreateProperties[] };
    expect(mockChrome.__createdTabs.at(-1)?.url).toBe('chrome-extension://mock/options.html');
  });

  it('loads an existing note from the hash when present', async () => {
    window.history.replaceState(null, '', '/newtab.html#existing-id');
    readNote.mockResolvedValue({
      id: 'existing-id',
      content: '# Existing',
      title: 'Saved title',
      createdAt: 1,
      modifiedAt: 2
    });

    await import('../../entrypoints/newtab/index');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(generateUUID).not.toHaveBeenCalled();
    expect(readNote).toHaveBeenCalledWith('existing-id');
    expect(initEditor).toHaveBeenCalledWith('# Existing');
    expect(initTitleActions).toHaveBeenCalledWith('Saved title', '# Existing');
  });
});
