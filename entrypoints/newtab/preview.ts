import { marked, type Tokens } from 'marked';
import highlight from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; // We'll let CSS overrides handle light/dark mode

// Configure marked with highlight.js
marked.setOptions({
    gfm: true,
    breaks: false
});

const renderer = new marked.Renderer();
renderer.code = ({ text, lang }: Tokens.Code) => {
    const normalizedLanguage = lang?.trim().toLowerCase();

    if (normalizedLanguage && highlight.getLanguage(normalizedLanguage)) {
        const highlighted = highlight.highlight(text, { language: normalizedLanguage }).value;
        return `<pre><code class="hljs language-${normalizedLanguage}">${highlighted}</code></pre>`;
    }

    const highlighted = normalizedLanguage
        ? highlight.highlightAuto(text).value
        : highlight.highlight(text, { language: 'plaintext' }).value;

    return `<pre><code class="hljs">${highlighted}</code></pre>`;
};
marked.use({ renderer });

export async function renderPreview(markdownStr: string): Promise<string> {
    // Parse might be sync but defined as returning Promise|string in some typings
    const result = await marked.parse(markdownStr);
    return result;
}

export function showPreviewContainer(html: string) {
    const container = document.getElementById('preview-container');
    if (container) {
        container.innerHTML = html;
        container.hidden = false;
    }
}

export function hidePreviewContainer() {
    const container = document.getElementById('preview-container');
    if (container) {
        container.hidden = true;
        container.innerHTML = ''; // clear memory
    }
}
