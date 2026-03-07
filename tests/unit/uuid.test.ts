import { describe, expect, it } from 'vitest';
import { generateUUID } from '../../entrypoints/shared/uuid';

describe('generateUUID', () => {
    it('generates strings of correct length', () => {
        const uuid = generateUUID();
        expect(uuid.length).toBe(36);
    });

    it('generates unique values', () => {
        const set = new Set();
        for (let i = 0; i < 1000; i++) {
            set.add(generateUUID());
        }
        expect(set.size).toBe(1000);
    });
});
