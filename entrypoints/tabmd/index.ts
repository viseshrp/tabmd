import './style.css';
import { createTabmdBackupFileName } from '../shared/backup_filename';
import {
  ensureCollections,
  readCollections,
  readSettings,
  type WorkspaceCollection,
  writeCollections
} from '../shared/storage';
import { formatTimestamp, logExtensionError } from '../shared/utils';
import { createSnackbarNotifier } from '../ui/notifications';
import { countCollections, countItems, filterCollections } from './list';
import { openResource } from './restore';

const collectionsEl = document.querySelector<HTMLDivElement>('#collections');
const emptyEl = document.querySelector<HTMLDivElement>('#empty');
const snackbarEl = document.querySelector<HTMLDivElement>('#snackbar');
const searchEl = document.querySelector<HTMLInputElement>('#searchCollections');
const collectionCountEl = document.querySelector<HTMLSpanElement>('#collectionCount');
const toggleIoEl = document.querySelector<HTMLButtonElement>('#toggleIo');
const ioPanelEl = document.querySelector<HTMLElement>('#ioPanel');
const exportJsonEl = document.querySelector<HTMLButtonElement>('#exportJson');
const importJsonEl = document.querySelector<HTMLButtonElement>('#importJson');
const clearJsonEl = document.querySelector<HTMLButtonElement>('#clearJson');
const jsonAreaEl = document.querySelector<HTMLTextAreaElement>('#jsonArea');
const scrollTopEl = document.querySelector<HTMLButtonElement>('#scrollTop');
const scrollBottomEl = document.querySelector<HTMLButtonElement>('#scrollBottom');

const notifier = createSnackbarNotifier(snackbarEl);

let allCollections: WorkspaceCollection[] = [];

function applyTheme(theme: 'os' | 'light' | 'dark'): void {
  if (theme === 'os') {
    document.documentElement.removeAttribute('data-theme');
    return;
  }
  document.documentElement.setAttribute('data-theme', theme);
}

function setStatus(message: string): void {
  notifier.notify(message);
}

function render(collections: WorkspaceCollection[]): void {
  if (!collectionsEl || !emptyEl || !collectionCountEl) return;
  collectionCountEl.textContent = String(countCollections(collections));
  emptyEl.hidden = collections.length > 0;
  collectionsEl.replaceChildren();

  const fragment = document.createDocumentFragment();

  for (const collection of collections) {
    const card = document.createElement('section');
    card.className = 'collection-card';

    const header = document.createElement('div');
    header.className = 'collection-header';

    const copy = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'collection-title';
    title.textContent = collection.title;
    const description = document.createElement('p');
    description.className = 'collection-description';
    description.textContent = collection.description;
    const meta = document.createElement('p');
    meta.className = 'item-meta';
    meta.textContent = `${collection.items.length} items • ${formatTimestamp(collection.createdAt)}`;
    copy.append(title, description, meta);

    const actions = document.createElement('div');
    actions.className = 'collection-actions';
    const badge = document.createElement('span');
    badge.className = 'pill';
    badge.textContent = `${countItems([collection])} resources`;
    actions.appendChild(badge);

    header.append(copy, actions);

    const list = document.createElement('ul');
    list.className = 'resource-list';

    for (const item of collection.items) {
      const entry = document.createElement('li');
      entry.className = 'resource-item';

      const main = document.createElement('div');
      const itemTitle = document.createElement('p');
      itemTitle.className = 'item-title';
      itemTitle.textContent = item.title;
      const itemSummary = document.createElement('p');
      itemSummary.className = 'item-summary';
      itemSummary.textContent = item.summary;
      const itemMeta = document.createElement('p');
      itemMeta.className = 'item-meta';
      itemMeta.textContent = `${item.url} • ${item.tags.join(', ')}`;
      main.append(itemTitle, itemSummary, itemMeta);

      const itemActions = document.createElement('div');
      itemActions.className = 'item-actions';
      const openButton = document.createElement('button');
      openButton.className = 'text-button';
      openButton.type = 'button';
      openButton.textContent = 'Open';
      openButton.addEventListener('click', async () => {
        const settings = await readSettings();
        await openResource(item, settings.openInNewTab);
        setStatus(`Opened ${item.title}.`);
      });
      itemActions.appendChild(openButton);

      entry.append(main, itemActions);
      list.appendChild(entry);
    }

    card.append(header, list);
    fragment.appendChild(card);
  }

  collectionsEl.appendChild(fragment);
}

async function refresh(): Promise<void> {
  allCollections = await ensureCollections();
  render(filterCollections(allCollections, searchEl?.value ?? ''));
}

async function exportJson(): Promise<void> {
  if (!jsonAreaEl) return;
  const collections = await readCollections();
  jsonAreaEl.value = JSON.stringify({ collections }, null, 2);

  try {
    await navigator.clipboard.writeText(jsonAreaEl.value);
  } catch (error) {
    logExtensionError('Failed to copy export JSON', error, 'runtime_context');
  }

  const blob = new Blob([jsonAreaEl.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = createTabmdBackupFileName(Date.now(), collections.length);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus('Exported collections.');
}

async function importJson(): Promise<void> {
  if (!jsonAreaEl) return;
  try {
    const parsed = JSON.parse(jsonAreaEl.value) as { collections?: WorkspaceCollection[] };
    if (!Array.isArray(parsed.collections)) {
      setStatus('Import failed. JSON structure not recognized.');
      return;
    }
    await writeCollections(parsed.collections);
    await refresh();
    setStatus('Imported collections.');
  } catch (error) {
    logExtensionError('Failed to import JSON', error, 'runtime_context');
    setStatus('Import failed. Invalid JSON.');
  }
}

function bindEvents(): void {
  searchEl?.addEventListener('input', () => {
    render(filterCollections(allCollections, searchEl.value));
  });

  toggleIoEl?.addEventListener('click', () => {
    if (!ioPanelEl) return;
    ioPanelEl.hidden = !ioPanelEl.hidden;
  });

  exportJsonEl?.addEventListener('click', () => {
    void exportJson();
  });

  importJsonEl?.addEventListener('click', () => {
    void importJson();
  });

  clearJsonEl?.addEventListener('click', () => {
    if (jsonAreaEl) jsonAreaEl.value = '';
    setStatus('Cleared text area.');
  });

  scrollTopEl?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  scrollBottomEl?.addEventListener('click', () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
}

async function init(): Promise<void> {
  const settings = await readSettings();
  applyTheme(settings.theme);
  bindEvents();
  await refresh();
}

void init().catch((error) => {
  logExtensionError('Failed to initialize tabmd page', error, 'runtime_context');
});
