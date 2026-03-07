// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { performExport } from '../../entrypoints/newtab/export';

// Mocking the DOM objects
global.Blob = class Blob {
    constructor(public content: any[], public options: any) { }
} as any;

global.URL = {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: () => { }
} as any;

describe('export', () => {
    it('creates an anchor with sanitized title', () => {
        const originalCreateElement = document.createElement.bind(document);
        let appendedChild: HTMLAnchorElement | null = null;
        let clicked = false;

        document.createElement = (tag: string) => {
            const el = originalCreateElement(tag);
            if (tag === 'a') {
                el.click = () => { clicked = true; };
            }
            return el;
        };

        const originalAppend = document.body.appendChild.bind(document.body);
        document.body.appendChild = (child: any) => {
            appendedChild = child;
            return child;
        };

        const originalRemove = document.body.removeChild.bind(document.body);
        document.body.removeChild = () => { return {} as any; };

        performExport('Test/Title:*?', 'Content');

        expect(appendedChild).not.toBeNull();
        expect((appendedChild as any).download).toBe('Test-Title---.md');
        expect(clicked).toBe(true);

        // Restore
        document.createElement = originalCreateElement;
        document.body.appendChild = originalAppend;
        document.body.removeChild = originalRemove;
    });
});
