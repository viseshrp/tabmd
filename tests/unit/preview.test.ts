// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { renderPreview } from "../../entrypoints/newtab/preview";

describe("preview helpers", () => {
	it("renders markdown to HTML", () => {
		const html = renderPreview("## Heading\n\n```ts\nconst x = 1;\n```");

		expect(html).toContain("<h2>Heading</h2>");
		expect(html).toContain('<pre><code class="hljs language-ts">');
		expect(html).toContain("hljs-keyword");
	});

	it("falls back to plaintext highlighting for unknown languages", () => {
		const html = renderPreview("```unknownlang\nvalue\n```");

		expect(html).toContain('<pre><code class="hljs language-plaintext">');
		expect(html).toContain("value");
	});

	it("renders fenced code blocks without a language", () => {
		const html = renderPreview("```\nplain text\n```");

		expect(html).toContain(
			'<pre><code class="hljs language-plaintext">plain text',
		);
	});
});
