import type { ResourceItem } from '../shared/storage';

export function parseOneTabExport(text: string): ResourceItem[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => {
      const [urlPart, titlePart] = line.split('|').map((segment) => segment.trim());
      if (!urlPart || !/^https?:\/\//.test(urlPart)) return null;
      return {
        id: `import-${index}-${Date.now()}`,
        title: titlePart || urlPart,
        url: urlPart,
        summary: 'Imported resource',
        tags: ['imported'],
        savedAt: Date.now()
      } satisfies ResourceItem;
    })
    .filter((item): item is ResourceItem => item !== null);
}

