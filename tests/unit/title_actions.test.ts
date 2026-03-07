// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateNoteTitle = vi.fn();
const getEditorContent = vi.fn(() => '# Derived title\nBody');

vi.mock('../../entrypoints/newtab/save', () => ({
  updateNoteTitle
}));

vi.mock('../../entrypoints/newtab/editor', () => ({
  getEditorContent
}));

describe('title actions', () => {
  beforeEach(() => {
    vi.resetModules();
    updateNoteTitle.mockReset();
    getEditorContent.mockReset();
    getEditorContent.mockReturnValue('# Derived title\nBody');
    document.body.innerHTML = `
      <h1 id="note-title-display"></h1>
      <input id="note-title-input" hidden />
    `;
  });

  it('syncs derived titles and saves manual overrides on blur', async () => {
    const { initTitleActions } = await import('../../entrypoints/newtab/title');
    const display = document.getElementById('note-title-display') as HTMLHeadingElement;
    const input = document.getElementById('note-title-input') as HTMLInputElement;

    initTitleActions(null, '# Heading\nBody');
    expect(display.textContent).toBe('Heading');

    display.click();
    expect(display.hidden).toBe(true);
    expect(input.hidden).toBe(false);

    input.value = '  Manual title  ';
    input.dispatchEvent(new FocusEvent('blur'));

    expect(updateNoteTitle).toHaveBeenCalledWith('Manual title');
    expect(display.hidden).toBe(false);
    expect(input.hidden).toBe(true);
    expect(display.textContent).toBe('Manual title');
  });

  it('reverts the input to the initial title on escape', async () => {
    const { initTitleActions } = await import('../../entrypoints/newtab/title');
    const display = document.getElementById('note-title-display') as HTMLHeadingElement;
    const input = document.getElementById('note-title-input') as HTMLInputElement;

    initTitleActions('Initial title', 'Body');
    display.click();
    input.value = 'Changed';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(input.value).toBe('Initial title');
    expect(updateNoteTitle).toHaveBeenCalledWith('Initial title');
  });
});
