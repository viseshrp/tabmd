import type { WorkspaceCollection } from './storage';

export function uniqueCollectionItems(collections: WorkspaceCollection[]): WorkspaceCollection[] {
  return collections.map((collection) => {
    const seen = new Set<string>();
    return {
      ...collection,
      items: collection.items.filter((item) => {
        if (seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      }),
    };
  });
}

