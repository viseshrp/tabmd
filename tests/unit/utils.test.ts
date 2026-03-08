import { describe, expect, it, vi } from "vitest";
import {
	formatTimestamp,
	logExtensionError,
	runWithConcurrency,
} from "../../entrypoints/shared/utils";

describe("utils", () => {
	it("logs extension errors with the operation prefix", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});

		logExtensionError("Failed", new Error("boom"), "storage");
		logExtensionError("Failed object", new Error("boom"), {
			operation: "options_page",
		});

		expect(spy).toHaveBeenCalledWith(
			"[tabmd:storage] Failed",
			expect.any(Error),
		);
		expect(spy).toHaveBeenCalledWith(
			"[tabmd:options_page] Failed object",
			expect.any(Error),
		);
		spy.mockRestore();
	});

	it("formats timestamps using Intl.DateTimeFormat", () => {
		const formatted = formatTimestamp(Date.UTC(2026, 2, 7, 12, 30));
		expect(formatted.length).toBeGreaterThan(0);
	});

	it("runs async work with bounded concurrency", async () => {
		const completed: number[] = [];
		let inFlight = 0;
		let maxInFlight = 0;

		await runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
			inFlight += 1;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await Promise.resolve();
			completed.push(item);
			inFlight -= 1;
		});

		expect(completed.sort((left, right) => left - right)).toEqual([1, 2, 3, 4]);
		expect(maxInFlight).toBeLessThanOrEqual(2);
	});
});
