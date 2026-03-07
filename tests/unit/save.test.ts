// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteRecord } from '../../entrypoints/shared/storage';

const getEditorContent = vi.fn();
const readNote = vi.fn();
const writeNote = vi.fn();
const logExtensionError = vi.fn();

vi.mock('../../entrypoints/newtab/editor', () => ({
  getEditorContent
}));

vi.mock('../../entrypoints/shared/notes', () => ({
  readNote,
  writeNote
}));

vi.mock('../../entrypoints/shared/utils', () => ({
  logExtensionError
}));

function makeNote(): NoteRecord {
  return {
    id: 'note-1',
    content: 'Initial',
    title: null,
    createdAt: 1,
    modifiedAt: 1
  };
}

function captureVisibilityHandler() {
  let visibilityHandler: EventListener | undefined;
  vi.spyOn(document, 'addEventListener').mockImplementation((
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ) => {
    if (type === 'visibilitychange' && typeof handler === 'function') {
      visibilityHandler = handler;
    }
    return EventTarget.prototype.addEventListener.call(document, type, handler, options);
  });
  return () => visibilityHandler?.(new Event('visibilitychange'));
}

describe('save tracking', () => {
  beforeEach(() => {
    vi.resetModules();
    getEditorContent.mockReset();
    readNote.mockReset();
    writeNote.mockReset();
    logExtensionError.mockReset();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes updated content on visibility change', async () => {
    const runVisibilityHandler = captureVisibilityHandler();

    const { initSaveTracking, updateNoteTitle } = await import('../../entrypoints/newtab/save');
    const note = makeNote();
    getEditorContent.mockReturnValue('Updated');
    readNote.mockResolvedValue({ ...note, title: 'Manual' });

    initSaveTracking(note);
    updateNoteTitle('Manual');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    runVisibilityHandler();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'note-1',
        content: 'Updated',
        title: 'Manual'
      })
    );
  });

  it('skips writes when content and title are unchanged', async () => {
    const runVisibilityHandler = captureVisibilityHandler();

    const { initSaveTracking } = await import('../../entrypoints/newtab/save');
    const note = makeNote();
    getEditorContent.mockReturnValue('Initial');
    readNote.mockResolvedValue({ ...note, title: null });

    initSaveTracking(note);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    runVisibilityHandler();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeNote).not.toHaveBeenCalled();
  });

  it('logs save failures', async () => {
    const runVisibilityHandler = captureVisibilityHandler();

    const { initSaveTracking } = await import('../../entrypoints/newtab/save');
    const note = makeNote();
    getEditorContent.mockReturnValue('Updated');
    writeNote.mockRejectedValue(new Error('save failed'));

    initSaveTracking(note);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    runVisibilityHandler();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logExtensionError).toHaveBeenCalledWith(
      'Failed to save note on blur',
      expect.any(Error),
      'save_logic'
    );
  });
});
