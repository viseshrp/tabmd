import type { WorkspaceCollection } from '../shared/storage';

export function countCollections(collections: WorkspaceCollection[]): number {
  return collections.length;
}

export function countItems(collections: WorkspaceCollection[]): number {
  return collections.reduce((total, collection) => total + collection.items.length, 0);
}

export function filterCollections(
  collections: WorkspaceCollection[],
  searchTerm: string
): WorkspaceCollection[] {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return collections;

  return collections
    .map((collection) => ({
      ...collection,
      items: collection.items.filter((item) =>
        [collection.title, collection.description, item.title, item.summary, item.url, item.tags.join(' ')]
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      )
    }))
    .filter((collection) => collection.items.length > 0);
}

