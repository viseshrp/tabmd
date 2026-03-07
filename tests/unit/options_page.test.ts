// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

describe("options settings page", () => {
	beforeEach(() => {
		vi.resetModules();
		document.body.innerHTML = `
      <section class="settings-panel">
        <div class="setting-item">
          <div class="setting-info">
            <div id="theme-setting-name">Theme</div>
            <div id="theme-setting-desc">Theme help text</div>
          </div>
          <fieldset id="theme-controls" aria-labelledby="theme-setting-name" aria-describedby="theme-setting-desc">
            <label>
              <input type="radio" name="theme" value="os" />
              <span>System</span>
            </label>
            <label>
              <input type="radio" name="theme" value="light" />
              <span>Light</span>
            </label>
            <label>
              <input type="radio" name="theme" value="dark" />
              <span>Dark</span>
            </label>
          </fieldset>
        </div>
      </section>
      <div id="snackbar"></div>
    `;
	});

	it("loads and saves the theme setting", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "light" },
			},
		});
		setMockChrome(mock);

		const { initSettingsPage } = await import(
			"../../entrypoints/options/settings_page"
		);
		await initSettingsPage();

		const light = document.querySelector<HTMLInputElement>(
			'input[value="light"]',
		);
		const dark = document.querySelector<HTMLInputElement>(
			'input[value="dark"]',
		);
		if (!light || !dark) throw new Error("Missing theme controls");

		expect(light.checked).toBe(true);
		dark.checked = true;
		dark.dispatchEvent(new Event("change", { bubbles: true }));

		// The save path is async because it persists settings before updating the page state.
		await vi.waitFor(() => {
			expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({
				theme: "dark",
			});
			expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
			expect(document.getElementById("snackbar")?.textContent).toContain(
				"Settings saved",
			);
		});
	});

	it("falls back gracefully when settings load fails", async () => {
		const mock = createMockChrome();
		mock.storage.local.get = async () => {
			throw new Error("read failed");
		};
		setMockChrome(mock);

		const { initSettingsPage } = await import(
			"../../entrypoints/options/settings_page"
		);
		await expect(initSettingsPage()).resolves.toBeUndefined();
	});

	it("removes the theme attribute for os mode", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);
		document.documentElement.setAttribute("data-theme", "dark");

		const { initSettingsPage } = await import(
			"../../entrypoints/options/settings_page"
		);
		await initSettingsPage();

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});
});
