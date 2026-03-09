// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import highlight from "highlight.js";
import { renderPreview } from "../../entrypoints/newtab/preview";

describe("preview helpers with large inputs", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("avoids auto-detect highlighting for unknown languages on large code fences", () => {
		const highlightAutoSpy = vi.spyOn(highlight, "highlightAuto");
		const markdown = `\`\`\`unknownlang\n${"const value = 1;\n".repeat(5_000)}\`\`\``;

		const html = renderPreview(markdown);

		expect(highlightAutoSpy).not.toHaveBeenCalled();
		expect(html).toContain('<pre><code class="hljs language-plaintext">');
		expect(html).toContain("const value = 1;");
	});

	it("uses the same deterministic plaintext fallback when no language is provided", () => {
		const highlightAutoSpy = vi.spyOn(highlight, "highlightAuto");
		const markdown = `\`\`\`\n${"plain text line\n".repeat(5_000)}\`\`\``;

		const html = renderPreview(markdown);

		expect(highlightAutoSpy).not.toHaveBeenCalled();
		expect(html).toContain('<pre><code class="hljs language-plaintext">');
		expect(html).toContain("plain text line");
	});
});
