import { describe, expect, it, beforeEach } from 'vitest';
import { readAllNotes, readNote, writeNote, deleteNote, listNotesSorted } from '../../entrypoints/shared/notes';
import { STORAGE_KEYS, type NoteRecord } from '../../entrypoints/shared/storage';
import { setMockChrome, createMockChrome } from '../helpers/mock_chrome';

describe('notes storage', () => {
    beforeEach(() => {
        setMockChrome(createMockChrome());
    });

    it('returns empty notes state initially', async () => {
        const notes = await readAllNotes();
        expect(notes).toEqual({});
    });

    it('can write and read a single note', async () => {
        const note: NoteRecord = {
            id: 'abc',
            content: 'hello',
            title: 'world',
            createdAt: 100,
            modifiedAt: 200
        };
        await writeNote(note);

        const read = await readNote('abc');
        expect(read).toEqual(note);
    });

    it('can delete a note', async () => {
        const note: NoteRecord = {
            id: 'xyz',
            content: '',
            title: null,
            createdAt: 0,
            modifiedAt: 0
        };
        await writeNote(note);
        await deleteNote('xyz');

        const read = await readNote('xyz');
        expect(read).toBeNull();
    });

    it('lists notes sorted by modifiedAt desc', async () => {
        const note1 = { id: '1', content: '', title: null, createdAt: 0, modifiedAt: 10 };
        const note2 = { id: '2', content: '', title: null, createdAt: 0, modifiedAt: 30 };
        const note3 = { id: '3', content: '', title: null, createdAt: 0, modifiedAt: 20 };

        await writeNote(note1);
        await writeNote(note2);
        await writeNote(note3);

        const sorted = await listNotesSorted();
        expect(sorted.map(n => n.id)).toEqual(['2', '3', '1']);
    });

    it('returns safe fallback when storage contains non-object data', async () => {
        await chrome.storage.local.set({ [STORAGE_KEYS.notes]: null });
        const dict = await readAllNotes();
        expect(dict).toEqual({});

        await chrome.storage.local.set({ [STORAGE_KEYS.notes]: [] });
        const dict2 = await readAllNotes();
        expect(dict2).toEqual({});
    });
});
