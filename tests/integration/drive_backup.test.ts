// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { initSettingsPage } from "../../entrypoints/options/settings_page";
import { DRIVE_STORAGE_KEYS } from "../../entrypoints/drive/types";
import { STORAGE_KEYS } from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

async function waitForCondition(
	predicate: () => boolean,
	cycles = 80,
): Promise<void> {
	for (let index = 0; index < cycles; index += 1) {
		if (predicate()) {
			return;
		}
		await Promise.resolve();
	}

	throw new Error(
		"Condition did not become true in expected microtask cycles.",
	);
}

function mountSettingsDom(): void {
	document.body.innerHTML = `
		<section class="settings-panel">
			<input id="themeOs" type="radio" name="theme" value="os" />
			<input id="themeLight" type="radio" name="theme" value="light" />
			<input id="themeDark" type="radio" name="theme" value="dark" />
		</section>
		<section class="drive-backup">
			<button id="openDriveAuth" type="button">Connect to Google Drive</button>
			<button id="backupNow" type="button">Backup now</button>
			<button id="openDriveRestore" type="button">Restore from backup</button>
			<input id="driveRetentionCount" type="number" />
			<div id="driveStatus"></div>
		</section>
		<dialog id="driveRestoreDialog">
			<button id="closeDriveRestore" type="button">Close</button>
			<table><tbody id="driveBackupList"></tbody></table>
			<select id="driveRestorePageSize">
				<option value="5" selected>5</option>
				<option value="10">10</option>
			</select>
			<button id="previousDriveBackupsPage" type="button">Previous</button>
			<button id="nextDriveBackupsPage" type="button">Next</button>
		</dialog>
		<div id="snackbar" hidden></div>
	`;
}

describe("drive backup integration", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("backs up notes from the options Drive section", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
				[STORAGE_KEYS.notes]: {
					"note-1": {
						id: "note-1",
						content: "Hello",
						title: null,
						createdAt: 1,
						modifiedAt: 2,
					},
				},
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};
		setMockChrome(mock);

		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";

			if (
				method === "GET" &&
				url.includes("/drive/v3/files?") &&
				url.includes("mimeType")
			) {
				return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			if (method === "GET" && url.includes("/drive/v3/files?")) {
				return new Response(
					JSON.stringify({
						files: [
							{
								id: "new-file",
								name: "tabmd-backup-2024-01-02T00-00-00-000Z-n1.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "100",
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			if (method === "POST" && url.includes("/upload/drive/v3/files")) {
				return new Response(
					JSON.stringify({
						id: "new-file",
						name: "uploaded.json",
						createdTime: "2024-01-02T00:00:00.000Z",
						size: "100",
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			return new Response("", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		mountSettingsDom();
		await initSettingsPage(document);

		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const driveStatus = document.querySelector<HTMLDivElement>("#driveStatus");
		if (!backupNow || !driveStatus) {
			throw new Error("Missing backup controls");
		}

		backupNow.click();
		await waitForCondition(() => {
			const backupIndex = mock.__storageData[
				DRIVE_STORAGE_KEYS.driveBackupIndex
			] as { backups?: Array<{ fileId: string }> } | undefined;
			return backupIndex?.backups?.[0]?.fileId === "new-file";
		});
		await waitForCondition(() =>
			(driveStatus.textContent ?? "").includes("Backup completed"),
		);

		expect(driveStatus.textContent).toContain("Backup completed");
		expect(
			mock.__storageData[DRIVE_STORAGE_KEYS.driveBackupIndex],
		).toBeTruthy();
	});

	it("skips upload when there are no notes to back up", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};
		setMockChrome(mock);

		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ files: [] }), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		mountSettingsDom();
		await initSettingsPage(document);

		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const driveStatus = document.querySelector<HTMLDivElement>("#driveStatus");
		if (!backupNow || !driveStatus) {
			throw new Error("Missing backup controls");
		}

		backupNow.click();
		await waitForCondition(() =>
			(driveStatus.textContent ?? "").includes("Nothing to backup."),
		);

		const uploadCalls = fetchMock.mock.calls.filter((call) => {
			const input = call.at(0);
			return String(input ?? "").includes("/upload/drive/v3/files");
		});
		expect(uploadCalls).toHaveLength(0);
	});

	it("connects and disconnects in place", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		mock.identity.getAuthToken = (details, callback) => {
			if (details.interactive === false) {
				callback(undefined);
				return;
			}
			delete mock.runtime.lastError;
			callback("token-1");
		};
		let removedToken = "";
		mock.identity.removeCachedAuthToken = (details, callback) => {
			removedToken = details.token;
			callback?.();
		};
		setMockChrome(mock);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("", { status: 200 })),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const connectButton =
			document.querySelector<HTMLButtonElement>("#openDriveAuth");
		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const driveStatus = document.querySelector<HTMLDivElement>("#driveStatus");
		if (!connectButton || !backupNow || !driveStatus) {
			throw new Error("Missing auth controls");
		}

		expect(backupNow.disabled).toBe(true);

		connectButton.click();
		await waitForCondition(() =>
			(driveStatus.textContent ?? "").includes("Connected to Google Drive."),
		);
		expect(backupNow.disabled).toBe(false);

		connectButton.click();
		await waitForCondition(() =>
			(driveStatus.textContent ?? "").includes(
				"Disconnected from Google Drive.",
			),
		);
		expect(removedToken).toBe("token-1");
		expect(backupNow.disabled).toBe(true);
	});

	it("loads restore backups and restores a selected snapshot", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "light" },
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};
		setMockChrome(mock);

		const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
			const url = String(input);
			const method = init?.method ?? "GET";

			if (
				method === "GET" &&
				url.includes("/drive/v3/files?") &&
				url.includes("mimeType")
			) {
				return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			if (method === "GET" && url.includes("alt=media")) {
				return new Response(
					JSON.stringify({
						notes: {
							"note-9": {
								id: "note-9",
								content: "Restored note",
								title: "Saved",
								createdAt: 10,
								modifiedAt: 11,
							},
						},
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			if (method === "GET" && url.includes("/drive/v3/files?")) {
				return new Response(
					JSON.stringify({
						files: [
							{
								id: "f1",
								name: "tabmd-backup-2024-01-02T00-00-00-000Z-n1.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "100",
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			return new Response("", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		const driveStatus = document.querySelector<HTMLDivElement>("#driveStatus");
		if (!openRestore || !backupTable || !driveStatus) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="restore-backup"]')
					.length === 1,
		);

		const restoreButton = backupTable.querySelector<HTMLButtonElement>(
			'button[data-action="restore-backup"]',
		);
		if (!restoreButton) {
			throw new Error("Missing restore button");
		}

		restoreButton.click();
		await waitForCondition(() =>
			(driveStatus.textContent ?? "").includes("Restore completed."),
		);

		expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({
			theme: "light",
		});
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});
});
