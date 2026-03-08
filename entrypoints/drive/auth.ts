/**
 * Promise-based wrappers around `chrome.identity` used by the Drive backup feature.
 * Keeping auth logic in one place prevents callback-style runtime checks from leaking into UI code.
 */

/** Returns true when the identity API is available in the current runtime context. */
export function isIdentityApiAvailable(): boolean {
	return (
		typeof chrome !== "undefined" &&
		typeof chrome.identity?.getAuthToken === "function"
	);
}

/**
 * Requests an OAuth token from Chrome Identity.
 * Non-interactive calls are used only to check existing cached auth state.
 */
export async function getAuthToken(interactive: boolean): Promise<string> {
	if (!isIdentityApiAvailable()) {
		throw new Error("Google Drive auth is unavailable in this context.");
	}

	return new Promise<string>((resolve, reject) => {
		chrome.identity.getAuthToken({ interactive }, (tokenResult) => {
			const message = chrome.runtime.lastError?.message;
			if (message) {
				reject(new Error(message));
				return;
			}

			const token =
				typeof tokenResult === "string"
					? tokenResult
					: tokenResult &&
							typeof tokenResult === "object" &&
							typeof (tokenResult as { token?: unknown }).token === "string"
						? (tokenResult as { token: string }).token
						: "";

			if (token.length === 0) {
				reject(new Error("No auth token returned by chrome.identity."));
				return;
			}

			resolve(token);
		});
	});
}

/**
 * Converts common OAuth configuration errors into user-actionable guidance.
 * Non-auth errors are preserved verbatim so unexpected failures remain debuggable.
 */
export function formatDriveAuthError(
	error: unknown,
	fallbackMessage: string,
): string {
	const rawMessage = error instanceof Error ? error.message.trim() : "";
	if (rawMessage.length === 0) {
		return fallbackMessage;
	}

	const normalized = rawMessage.toLowerCase();
	if (
		normalized.includes("did not approve access") ||
		normalized.includes("did not authorize access") ||
		normalized.includes("access denied") ||
		normalized.includes("user canceled") ||
		normalized.includes("user cancelled") ||
		normalized.includes("sign in cancelled") ||
		normalized.includes("sign in canceled")
	) {
		return "Google sign-in was cancelled.";
	}

	if (!normalized.includes("bad client id")) {
		return rawMessage;
	}

	const extensionId =
		typeof chrome !== "undefined" && chrome.runtime?.id
			? chrome.runtime.id
			: "unknown";
	return [
		"Google Drive OAuth client configuration does not match this extension build.",
		`Current extension ID: ${extensionId}.`,
		"This build now uses an independent manifest key for TabMD.",
		"Create a Chrome Extension OAuth client for this exact extension ID and replace the baked-in client ID in wxt.config.ts, then rebuild and reload the extension.",
	].join(" ");
}

/** Returns the cached auth token when available, otherwise `null`. */
export async function getAuthTokenSilently(): Promise<string | null> {
	try {
		return await getAuthToken(false);
	} catch {
		return null;
	}
}

/** Removes a token from the local Chrome identity cache. */
export async function removeCachedAuthToken(token: string): Promise<void> {
	if (!isIdentityApiAvailable()) {
		return;
	}

	await new Promise<void>((resolve) => {
		chrome.identity.removeCachedAuthToken({ token }, () => {
			resolve();
		});
	});
}

/**
 * Best-effort token revocation against Google's revoke endpoint.
 * Restore and disconnect flows ignore failures here because the local cache is already cleared.
 */
export async function revokeToken(token: string): Promise<void> {
	if (typeof fetch !== "function") {
		return;
	}

	try {
		const url = `https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`;
		await fetch(url, { method: "POST" });
	} catch {
		// Revoke failures are intentionally ignored because local disconnect already succeeded.
	}
}
