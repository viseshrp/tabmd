import { describe, expect, it } from 'vitest';
import { resolveNoteTitle } from '../../entrypoints/shared/note_title';

describe('resolveNoteTitle', () => {
    it('uses specific manual title if present', () => {
        expect(resolveNoteTitle({ title: 'My Title', content: '# Hello' })).toBe('My Title');
    });

    it('strips whitespace from manual title', () => {
        expect(resolveNoteTitle({ title: '  My Title  ', content: '# Hello' })).toBe('My Title');
    });

    it('falls back if manual title is empty or only whitespace', () => {
        expect(resolveNoteTitle({ title: '   ', content: '# Hello' })).toBe('Hello');
    });

    it('extracts the first line of content', () => {
        expect(resolveNoteTitle({ title: null, content: 'First line\nSecond line' })).toBe('First line');
    });

    it('strips leading # characters and whitespace', () => {
        expect(resolveNoteTitle({ title: null, content: '##   Heading 2\nContent' })).toBe('Heading 2');
    });

    it('returns Untitled if content is empty', () => {
        expect(resolveNoteTitle({ title: null, content: '' })).toBe('Untitled');
    });

    it('returns Untitled if content is only whitespace', () => {
        expect(resolveNoteTitle({ title: null, content: '   \n  ' })).toBe('Untitled');
    });
});
