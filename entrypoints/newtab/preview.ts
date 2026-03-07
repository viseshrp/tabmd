import highlight from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { marked, type Tokens } from "marked";

// EasyMDE expects preview rendering to be synchronous so the view switch happens in one step.
marked.setOptions({
	gfm: true,
	breaks: false,
});

const renderer = new marked.Renderer();

renderer.code = ({ text, lang }: Tokens.Code) => {
	const normalizedLanguage = lang?.trim().toLowerCase();

	if (normalizedLanguage && highlight.getLanguage(normalizedLanguage)) {
		const highlighted = highlight.highlight(text, {
			language: normalizedLanguage,
		}).value;
		return `<pre><code class="hljs language-${normalizedLanguage}">${highlighted}</code></pre>`;
	}

	const highlighted = normalizedLanguage
		? highlight.highlightAuto(text).value
		: highlight.highlight(text, { language: "plaintext" }).value;

	return `<pre><code class="hljs">${highlighted}</code></pre>`;
};

marked.use({ renderer });

export function renderPreview(markdownStr: string): string {
	return marked(markdownStr, { async: false });
}
