import { describe, expect, it } from 'vitest';
import { countCollections, countItems, filterCollections } from '../../entrypoints/tabmd/list';
import type { WorkspaceCollection } from '../../entrypoints/shared/storage';

const collections: WorkspaceCollection[] = [
  {
    id: 'one',
    title: 'Design',
    description: 'Patterns',
    createdAt: 1,
    items: [
      {
        id: '1',
        title: 'App shell',
        url: 'https://example.com/shell',
        summary: 'Shell',
        tags: ['ui'],
        savedAt: 1,
      },
    ],
  },
  {
    id: 'two',
    title: 'Docs',
    description: 'Guides',
    createdAt: 2,
    items: [
      {
        id: '2',
        title: 'Release flow',
        url: 'https://example.com/release',
        summary: 'CI/CD',
        tags: ['ci'],
        savedAt: 2,
      },
    ],
  },
];

describe('list helpers', () => {
  it('counts collections and items', () => {
    expect(countCollections(collections)).toBe(2);
    expect(countItems(collections)).toBe(2);
  });

  it('filters matching resources', () => {
    const filtered = filterCollections(collections, 'release');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe('Docs');
  });
});

