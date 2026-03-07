// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { hidePreviewContainer, renderPreview, showPreviewContainer } from '../../entrypoints/newtab/preview';

describe('preview helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="preview-container" hidden></div>';
  });

  it('renders markdown to HTML', async () => {
    const html = await renderPreview('## Heading\n\n```ts\nconst x = 1;\n```');
    expect(html).toContain('<h2>Heading</h2>');
    expect(html).toContain('<pre><code class="hljs language-ts">');
    expect(html).toContain('hljs-keyword');
  });

  it('falls back to auto highlighting for unknown languages', async () => {
    const html = await renderPreview('```unknownlang\nvalue\n```');
    expect(html).toContain('<pre><code class="hljs">');
    expect(html).toContain('value');
  });

  it('renders fenced code blocks without a language', async () => {
    const html = await renderPreview('```\nplain text\n```');
    expect(html).toContain('<pre><code class="hljs">plain text');
  });

  it('shows and hides the preview container', () => {
    const container = document.getElementById('preview-container') as HTMLDivElement;

    showPreviewContainer('<p>preview</p>');
    expect(container.hidden).toBe(false);
    expect(container.innerHTML).toContain('preview');

    hidePreviewContainer();
    expect(container.hidden).toBe(true);
    expect(container.innerHTML).toBe('');
  });

  it('does nothing when the preview container is missing', () => {
    document.body.innerHTML = '';

    expect(() => showPreviewContainer('<p>preview</p>')).not.toThrow();
    expect(() => hidePreviewContainer()).not.toThrow();
  });
});
