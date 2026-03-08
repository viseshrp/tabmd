import { beforeEach, describe, expect, it } from "vitest";
import {
	formatDriveAuthError,
	getAuthToken,
	getAuthTokenSilently,
	removeCachedAuthToken,
} from "../../entrypoints/drive/auth";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

describe("drive auth helpers", () => {
	beforeEach(() => {
		setMockChrome(createMockChrome());
	});

	it("rejects when the identity API is unavailable", async () => {
		const mock = createMockChrome();
		delete (mock as { identity?: unknown }).identity;
		setMockChrome(mock);

		await expect(getAuthToken(true)).rejects.toThrow(
			"Google Drive auth is unavailable",
		);
	});

	it("returns a token from chrome.identity and supports silent lookups", async () => {
		const mock = createMockChrome();
		mock.identity.getAuthToken = (details, callback) => {
			delete mock.runtime.lastError;
			callback(details.interactive ? "interactive-token" : "cached-token");
		};
		setMockChrome(mock);

		await expect(getAuthToken(true)).resolves.toBe("interactive-token");
		await expect(getAuthTokenSilently()).resolves.toBe("cached-token");
	});

	it("formats bad client id errors with extension guidance", () => {
		const mock = createMockChrome();
		mock.runtime.id = "extension-123";
		setMockChrome(mock);

		const message = formatDriveAuthError(
			new Error("bad client id"),
			"fallback",
		);
		expect(message).toContain("extension-123");
		expect(message).toContain("independent manifest key");
		expect(message).toContain("wxt.config.ts");
	});

	it("removes a cached token without throwing", async () => {
		const mock = createMockChrome();
		let removedToken = "";
		mock.identity.removeCachedAuthToken = (details, callback) => {
			removedToken = details.token;
			callback?.();
		};
		setMockChrome(mock);

		await removeCachedAuthToken("token-1");
		expect(removedToken).toBe("token-1");
	});
});
