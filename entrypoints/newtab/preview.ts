import { marked } from 'marked';
import highlight from 'highlight.js';
import 'highlight.js/styles/github-dark.css'; // We'll let CSS overrides handle light/dark mode

// Configure marked with highlight.js
marked.setOptions({
    gfm: true,
    breaks: false
} as any);

const renderer = new marked.Renderer();
// Use highlight.js
renderer.code = ({
    text,
    lang
}: {
    text: string;
    lang?: string;
}) => {
    const language = highlight.getLanguage(lang || '') ? lang : 'plaintext';
    if (language) {
        const validLanguage = highlight.getLanguage(language) ? language : 'plaintext';
        return `<pre><code class="hljs ${validLanguage}">${highlight.highlight(text, { language: validLanguage }).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${highlight.highlightAuto(text).value}</code></pre>`;
};
marked.use({ renderer } as any);

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
