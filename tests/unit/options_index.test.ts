// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushMicrotasks } from "../helpers/flush";

const initSettingsPage = vi.fn();
const logExtensionError = vi.fn();

vi.mock("../../entrypoints/options/settings_page", () => ({
	initSettingsPage,
}));

vi.mock("../../entrypoints/shared/utils", () => ({
	logExtensionError,
}));

describe("options index", () => {
	beforeEach(() => {
		vi.resetModules();
		initSettingsPage.mockReset();
		logExtensionError.mockReset();
	});

	it("boots the settings page", async () => {
		initSettingsPage.mockResolvedValue(undefined);
		await import("../../entrypoints/options/index");
		await flushMicrotasks();

		expect(initSettingsPage).toHaveBeenCalled();
	});

	it("logs bootstrap failures", async () => {
		initSettingsPage.mockRejectedValue(new Error("boom"));
		await import("../../entrypoints/options/index");
		await flushMicrotasks();

		expect(logExtensionError).toHaveBeenCalledWith(
			"Failed to initialize settings page",
			expect.any(Error),
			{ operation: "runtime_context" },
		);
	});
});
