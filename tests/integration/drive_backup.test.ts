// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { initSettingsPage } from "../../entrypoints/options/settings_page";
import { DRIVE_STORAGE_KEYS } from "../../entrypoints/drive/types";
import { STORAGE_KEYS } from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

type NoteFixture = {
	id: string;
	content: string;
	title: string | null;
	createdAt: number;
	modifiedAt: number;
};

/**
 * Drive UI work is promise-driven, so tests advance by flushing microtasks
 * until the expected visible condition becomes true.
 */
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

/** Mounts the subset of the settings page DOM that the Drive integration needs. */
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
				<option value="15">15</option>
				<option value="20">20</option>
			</select>
			<button id="previousDriveBackupsPage" type="button">Previous</button>
			<button id="nextDriveBackupsPage" type="button">Next</button>
		</dialog>
		<div id="snackbar" hidden></div>
	`;
}

/** Keeps the repetitive note shape consistent across backup and restore fixtures. */
function createNote(
	id: string,
	content = "Hello",
	title: string | null = null,
	createdAt = 1,
	modifiedAt = 2,
): NoteFixture {
	return {
		id,
		content,
		title,
		createdAt,
		modifiedAt,
	};
}

function getDriveStatus(): HTMLDivElement {
	const driveStatus = document.querySelector<HTMLDivElement>("#driveStatus");
	if (!driveStatus) {
		throw new Error("Missing Drive status element");
	}
	return driveStatus;
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
					"note-1": createNote("note-1"),
				},
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [
						{
							fileId: "seed-file",
							fileName: "tabmd-backup-seed-n1.json",
							timestamp: 1700000000000,
							size: 12,
							noteCount: 1,
						},
					],
				},
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

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
		if (!backupNow) {
			throw new Error("Missing backup action");
		}

		backupNow.click();
		await waitForCondition(() => {
			const backupIndex = mock.__storageData[
				DRIVE_STORAGE_KEYS.driveBackupIndex
			] as { backups?: Array<{ fileId: string }> } | undefined;
			return backupIndex?.backups?.[0]?.fileId === "new-file";
		});
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("Backup completed"),
		);

		expect(getDriveStatus().textContent).toContain("Backup completed");
	});

	it("skips upload when there are no notes to back up", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		const fetchMock = vi.fn(
			async () => new Response(JSON.stringify({ files: [] }), { status: 200 }),
		);
		vi.stubGlobal("fetch", fetchMock);

		mountSettingsDom();
		await initSettingsPage(document);

		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		if (!backupNow) {
			throw new Error("Missing backup action");
		}

		backupNow.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("Nothing to backup."),
		);

		const uploadCalls = fetchMock.mock.calls.filter((call) =>
			String(call.at(0) ?? "").includes("/upload/drive/v3/files"),
		);
		expect(uploadCalls).toHaveLength(0);
	});

	it("keeps restore disabled when disconnected and surfaces auth and retention errors", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (details, callback) => {
			if (!details.interactive) {
				delete mock.runtime.lastError;
				callback(undefined);
				return;
			}
			mock.runtime.lastError = { message: "auth denied" };
			callback(undefined);
		};

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
								id: "fallback-file",
								name: "tabmd-backup-fallback-n4.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "2048",
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

		const openAuth =
			document.querySelector<HTMLButtonElement>("#openDriveAuth");
		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const retentionInput = document.querySelector<HTMLInputElement>(
			"#driveRetentionCount",
		);
		if (!openAuth || !backupNow || !openRestore || !retentionInput) {
			throw new Error("Missing Drive controls");
		}

		expect(backupNow.disabled).toBe(true);
		expect(openRestore.disabled).toBe(true);
		expect(openAuth.textContent).toContain("Connect to Google Drive");

		openAuth.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("auth denied"),
		);

		const originalSet = mock.storage.local.set;
		mock.storage.local.set = async (payload) => {
			if (Object.hasOwn(payload, DRIVE_STORAGE_KEYS.retentionCount)) {
				throw new Error("retention failed");
			}
			await originalSet(payload);
		};

		retentionInput.value = "8";
		retentionInput.dispatchEvent(new Event("change"));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Failed to save retention setting.",
			),
		);
	});

	it("loads fallback backups while connected and supports in-page disconnect", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (details, callback) => {
			delete mock.runtime.lastError;
			if (details.interactive === false) {
				callback("token-1");
				return;
			}
			callback("token-1");
		};

		const removeCachedAuthToken = vi.fn(
			(details: chrome.identity.InvalidTokenDetails, callback?: () => void) => {
				callback?.();
				return details;
			},
		);
		mock.identity.removeCachedAuthToken = removeCachedAuthToken;

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
								id: "fallback-file",
								name: "tabmd-backup-fallback-n4.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "2048",
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

		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const openAuth =
			document.querySelector<HTMLButtonElement>("#openDriveAuth");
		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		const restoreDialog = document.querySelector<HTMLDialogElement>(
			"#driveRestoreDialog",
		);
		if (
			!backupNow ||
			!openAuth ||
			!openRestore ||
			!backupTable ||
			!restoreDialog
		) {
			throw new Error("Missing Drive controls");
		}

		expect(backupNow.disabled).toBe(false);
		expect(openRestore.disabled).toBe(false);
		expect(openAuth.textContent).toContain("Connected to Google Drive");

		openRestore.click();
		await waitForCondition(
			() => backupTable.textContent?.includes("2 KB") ?? false,
		);
		expect(restoreDialog.open).toBe(true);

		openAuth.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Disconnected from Google Drive.",
			),
		);
		expect(removeCachedAuthToken).toHaveBeenCalledOnce();
		expect(backupNow.disabled).toBe(true);
		expect(openRestore.disabled).toBe(true);
		expect(openAuth.textContent).toContain("Connect to Google Drive");
	});

	it("connects in-page from disconnected state and enables backup action", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (details, callback) => {
			delete mock.runtime.lastError;
			if (details.interactive === false) {
				callback(undefined);
				return;
			}
			callback("token-connected");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ files: [] }), { status: 200 }),
			),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openAuth =
			document.querySelector<HTMLButtonElement>("#openDriveAuth");
		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		if (!openAuth || !backupNow || !openRestore) {
			throw new Error("Missing Drive controls");
		}

		expect(backupNow.disabled).toBe(true);
		expect(openRestore.disabled).toBe(true);

		openAuth.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Connected to Google Drive.",
			),
		);

		expect(openAuth.textContent).toContain("Connected to Google Drive");
		expect(backupNow.disabled).toBe(false);
		expect(openRestore.disabled).toBe(false);
	});

	it("shows disconnect error messaging and handles visibility refresh events", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};
		mock.identity.removeCachedAuthToken = () => {
			throw new Error("disconnect-failed");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL, init?: RequestInit) => {
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
					return new Response(JSON.stringify({ files: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openAuth =
			document.querySelector<HTMLButtonElement>("#openDriveAuth");
		const retentionInput = document.querySelector<HTMLInputElement>(
			"#driveRetentionCount",
		);
		if (!openAuth || !retentionInput) {
			throw new Error("Missing Drive controls");
		}

		retentionInput.value = "9";
		retentionInput.dispatchEvent(new Event("change"));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Retention saved: keep latest 9 backups.",
			),
		);

		document.dispatchEvent(new Event("visibilitychange"));
		await waitForCondition(
			() =>
				openAuth.textContent?.includes("Connected to Google Drive") ?? false,
		);

		openAuth.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("disconnect-failed"),
		);
	});

	it("loads an empty restore list into the modal and supports explicit modal close", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL, init?: RequestInit) => {
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
					return new Response(JSON.stringify({ files: [] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const closeRestore =
			document.querySelector<HTMLButtonElement>("#closeDriveRestore");
		const restoreDialog = document.querySelector<HTMLDialogElement>(
			"#driveRestoreDialog",
		);
		if (!openRestore || !closeRestore || !restoreDialog) {
			throw new Error("Missing restore controls");
		}

		const showModalMock = vi.fn(() => {
			restoreDialog.setAttribute("open", "");
		});
		const closeModalMock = vi.fn(() => {
			restoreDialog.removeAttribute("open");
		});
		restoreDialog.showModal = showModalMock as HTMLDialogElement["showModal"];
		restoreDialog.close = closeModalMock as HTMLDialogElement["close"];

		openRestore.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("No backups found."),
		);

		expect(showModalMock).toHaveBeenCalledOnce();
		expect(restoreDialog.open).toBe(true);

		closeRestore.click();
		expect(closeModalMock).toHaveBeenCalledOnce();
		expect(restoreDialog.open).toBe(false);
	});

	it("loads restore backups lazily with explicit next and previous page actions", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = String(input);
			if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
				return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (
				url.includes("/drive/v3/files?") &&
				url.includes("pageToken=token-2")
			) {
				return new Response(
					JSON.stringify({
						files: [
							{
								id: "f3",
								name: "tabmd-backup-third-n2.json",
								createdTime: "2024-01-03T00:00:00.000Z",
								size: "30",
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (url.includes("/drive/v3/files?")) {
				return new Response(
					JSON.stringify({
						files: [
							{
								id: "f1",
								name: "tabmd-backup-first-n1.json",
								createdTime: "2024-01-01T00:00:00.000Z",
								size: "10",
							},
							{
								id: "f2",
								name: "tabmd-backup-second-n1.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "20",
							},
						],
						nextPageToken: "token-2",
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
		const previousPage = document.querySelector<HTMLButtonElement>(
			"#previousDriveBackupsPage",
		);
		const nextPage = document.querySelector<HTMLButtonElement>(
			"#nextDriveBackupsPage",
		);
		const restorePageSize = document.querySelector<HTMLSelectElement>(
			"#driveRestorePageSize",
		);
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		if (
			!openRestore ||
			!previousPage ||
			!nextPage ||
			!restorePageSize ||
			!backupTable
		) {
			throw new Error("Missing restore controls");
		}

		restorePageSize.value = "5";
		openRestore.click();
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="restore-backup"]')
					.length === 2,
		);

		expect(previousPage.disabled).toBe(true);
		expect(nextPage.disabled).toBe(false);

		const initialListCalls = fetchMock.mock.calls.filter((call) => {
			const url = String(call.at(0) ?? "");
			return url.includes("/drive/v3/files?") && !url.includes("mimeType");
		});
		expect(initialListCalls).toHaveLength(1);
		expect(String(initialListCalls[0]?.[0])).toContain("pageSize=5");

		nextPage.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Showing 1 backup on this page.",
			),
		);
		expect(
			backupTable.querySelectorAll('button[data-action="restore-backup"]'),
		).toHaveLength(1);
		expect(previousPage.disabled).toBe(false);
		expect(nextPage.disabled).toBe(true);

		previousPage.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Showing 2 backups on this page.",
			),
		);
		expect(
			backupTable.querySelectorAll('button[data-action="restore-backup"]'),
		).toHaveLength(2);
		expect(previousPage.disabled).toBe(true);
		expect(nextPage.disabled).toBe(false);

		const downloadCalls = fetchMock.mock.calls.filter((call) =>
			String(call.at(0) ?? "").includes("alt=media"),
		);
		expect(downloadCalls).toHaveLength(0);
	});

	it("replaces visible rows immediately when the restore page size changes", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		const createFiles = (count: number) =>
			Array.from({ length: count }, (_, index) => ({
				id: `f${index + 1}`,
				name: `tabmd-backup-${index + 1}-n1.json`,
				createdTime: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
				size: String(10 + index),
			}));

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = String(input);
			if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
				return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url.includes("/drive/v3/files?") && url.includes("pageSize=10")) {
				return new Response(JSON.stringify({ files: createFiles(10) }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url.includes("/drive/v3/files?") && url.includes("pageSize=5")) {
				return new Response(JSON.stringify({ files: createFiles(5) }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("", { status: 200 });
		});
		vi.stubGlobal("fetch", fetchMock);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const restorePageSize = document.querySelector<HTMLSelectElement>(
			"#driveRestorePageSize",
		);
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		if (!openRestore || !restorePageSize || !backupTable) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="restore-backup"]')
					.length === 5,
		);

		restorePageSize.value = "10";
		restorePageSize.dispatchEvent(new Event("change"));
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="restore-backup"]')
					.length === 10,
		);

		restorePageSize.value = "5";
		restorePageSize.dispatchEvent(new Event("change"));
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="restore-backup"]')
					.length === 5,
		);
	});

	it("deletes a backup from the restore modal without downloading the payload", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

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
								id: "f1",
								name: "tabmd-backup-first-n1.json",
								createdTime: "2024-01-01T00:00:00.000Z",
								size: "10",
							},
							{
								id: "f2",
								name: "tabmd-backup-second-n1.json",
								createdTime: "2024-01-02T00:00:00.000Z",
								size: "20",
							},
						],
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				);
			}
			if (method === "DELETE" && url.includes("/drive/v3/files/f1")) {
				return new Response("", { status: 204 });
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
		if (!openRestore || !backupTable) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="delete-backup"]')
					.length === 2,
		);
		await waitForCondition(() => {
			const deleteButton = backupTable.querySelector<HTMLButtonElement>(
				'button[data-action="delete-backup"][data-file-id="f1"]',
			);
			return deleteButton !== null && deleteButton.disabled === false;
		});

		const deleteButton = backupTable.querySelector<HTMLButtonElement>(
			'button[data-action="delete-backup"][data-file-id="f1"]',
		);
		if (!deleteButton) {
			throw new Error("Missing delete action");
		}

		deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitForCondition(() =>
			fetchMock.mock.calls.some((call) => {
				const url = String(call.at(0) ?? "");
				const init = call[1] as RequestInit | undefined;
				return (
					url.includes("/drive/v3/files/f1") &&
					(init?.method ?? "GET") === "DELETE"
				);
			}),
		);

		const downloadCalls = fetchMock.mock.calls.filter((call) =>
			String(call.at(0) ?? "").includes("alt=media"),
		);
		expect(downloadCalls).toHaveLength(0);
	});

	it("surfaces delete errors from the restore modal", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL, init?: RequestInit) => {
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
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
								},
							],
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				if (method === "DELETE" && url.includes("/drive/v3/files/f1")) {
					return new Response("nope", { status: 500 });
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		if (!openRestore || !backupTable) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() =>
				backupTable.querySelectorAll('button[data-action="delete-backup"]')
					.length === 1,
		);

		const deleteButton = backupTable.querySelector<HTMLButtonElement>(
			'button[data-action="delete-backup"][data-file-id="f1"]',
		);
		if (!deleteButton) {
			throw new Error("Missing delete action");
		}

		deleteButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Drive delete file failed (500): nope",
			),
		);
	});

	it("loads the restore list interactively even when there is no cached token yet", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (details, callback) => {
			delete mock.runtime.lastError;
			if (!details.interactive) {
				callback(undefined);
				return;
			}
			callback("token-interactive");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url.includes("/drive/v3/files?")) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
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
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		if (!openRestore || !backupTable) {
			throw new Error("Missing restore controls");
		}

		openRestore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Showing 1 backup on this page.",
			),
		);
		expect(
			backupTable.querySelectorAll('button[data-action="restore-backup"]'),
		).toHaveLength(1);
	});

	it("keeps next enabled when more restore pages remain", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (
					url.includes("/drive/v3/files?") &&
					url.includes("pageToken=token-2")
				) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f2",
									name: "tabmd-backup-second-n1.json",
									createdTime: "2024-01-02T00:00:00.000Z",
									size: "20",
								},
							],
							nextPageToken: "token-3",
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				if (url.includes("/drive/v3/files?")) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
								},
							],
							nextPageToken: "token-2",
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const previousPage = document.querySelector<HTMLButtonElement>(
			"#previousDriveBackupsPage",
		);
		const nextPage = document.querySelector<HTMLButtonElement>(
			"#nextDriveBackupsPage",
		);
		if (!openRestore || !previousPage || !nextPage) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() => nextPage.disabled === false && previousPage.disabled === true,
		);

		nextPage.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Showing 1 backup on this page.",
			),
		);

		expect(previousPage.disabled).toBe(false);
		expect(nextPage.disabled).toBe(false);
	});

	it("shows next-page failure status when a backup page request fails", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (
					url.includes("/drive/v3/files?") &&
					url.includes("pageToken=token-2")
				) {
					return new Response("boom", { status: 500 });
				}
				if (url.includes("/drive/v3/files?")) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
								},
							],
							nextPageToken: "token-2",
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const nextPage = document.querySelector<HTMLButtonElement>(
			"#nextDriveBackupsPage",
		);
		if (!openRestore || !nextPage) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(() => nextPage.disabled === false);

		nextPage.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Drive list files failed (500): boom",
			),
		);
	});

	it("shows previous-page failure status when back navigation fails", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		let firstPageRequests = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (
					url.includes("/drive/v3/files?") &&
					url.includes("pageToken=token-2")
				) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f2",
									name: "tabmd-backup-second-n1.json",
									createdTime: "2024-01-02T00:00:00.000Z",
									size: "20",
								},
							],
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				if (url.includes("/drive/v3/files?")) {
					firstPageRequests += 1;
					if (firstPageRequests >= 2) {
						return new Response("prev-boom", { status: 500 });
					}
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
								},
							],
							nextPageToken: "token-2",
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const previousPage = document.querySelector<HTMLButtonElement>(
			"#previousDriveBackupsPage",
		);
		const nextPage = document.querySelector<HTMLButtonElement>(
			"#nextDriveBackupsPage",
		);
		if (!openRestore || !previousPage || !nextPage) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(
			() => nextPage.disabled === false && previousPage.disabled === true,
		);
		nextPage.click();
		await waitForCondition(() => previousPage.disabled === false);

		previousPage.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Drive list files failed (500): prev-boom",
			),
		);
	});

	it("shows page-size update failure status when the resize request fails", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (_details, callback) => {
			delete mock.runtime.lastError;
			callback("token-1");
		};

		let listRequestCount = 0;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url.includes("/drive/v3/files?")) {
					listRequestCount += 1;
					if (listRequestCount >= 2) {
						return new Response("resize-boom", { status: 500 });
					}
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "f1",
									name: "tabmd-backup-first-n1.json",
									createdTime: "2024-01-01T00:00:00.000Z",
									size: "10",
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
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const restorePageSize = document.querySelector<HTMLSelectElement>(
			"#driveRestorePageSize",
		);
		if (!openRestore || !restorePageSize) {
			throw new Error("Missing restore controls");
		}

		openRestore.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Showing 1 backup on this page.",
			),
		);

		restorePageSize.value = "10";
		restorePageSize.dispatchEvent(new Event("change"));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes(
				"Drive list files failed (500): resize-boom",
			),
		);
	});

	it("handles restore-list auth errors when restore is triggered without connection state", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "os" },
			},
		});
		setMockChrome(mock);

		mock.identity.getAuthToken = (details, callback) => {
			if (details.interactive) {
				mock.runtime.lastError = { message: "auth denied" };
				callback(undefined);
				return;
			}
			delete mock.runtime.lastError;
			callback(undefined);
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ files: [] }), { status: 200 }),
			),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		if (!openRestore) {
			throw new Error("Missing restore action");
		}

		openRestore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("auth denied"),
		);
	});

	it("shows backup auth errors and restores from the on-demand restore modal", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "light" },
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [
						{
							fileId: "seed-file",
							fileName: "tabmd-backup-seed-n1.json",
							timestamp: 1700000000000,
							size: 12,
							noteCount: 1,
						},
					],
				},
			},
		});
		setMockChrome(mock);

		let interactiveAuthFails = true;
		mock.identity.getAuthToken = (details, callback) => {
			if (details.interactive && interactiveAuthFails) {
				mock.runtime.lastError = { message: "auth denied" };
				callback(undefined);
				return;
			}
			delete mock.runtime.lastError;
			callback("token-1");
		};

		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				if (url.includes("/drive/v3/files?") && url.includes("mimeType")) {
					return new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					});
				}
				if (url.includes("/drive/v3/files?")) {
					return new Response(
						JSON.stringify({
							files: [
								{
									id: "seed-file",
									name: "tabmd-backup-seed-n1.json",
									createdTime: "2024-01-02T00:00:00.000Z",
									size: "12",
								},
							],
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				if (url.includes("alt=media")) {
					return new Response(
						JSON.stringify({
							notes: {
								restored: createNote(
									"restored",
									"Restored note",
									"Restored title",
									10,
									11,
								),
							},
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				}
				return new Response("", { status: 200 });
			}),
		);

		mountSettingsDom();
		await initSettingsPage(document);

		const backupNow = document.querySelector<HTMLButtonElement>("#backupNow");
		const openRestore =
			document.querySelector<HTMLButtonElement>("#openDriveRestore");
		const backupTable =
			document.querySelector<HTMLTableSectionElement>("#driveBackupList");
		const restoreDialog = document.querySelector<HTMLDialogElement>(
			"#driveRestoreDialog",
		);
		if (!backupNow || !openRestore || !backupTable || !restoreDialog) {
			throw new Error("Missing Drive controls");
		}

		backupNow.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("auth denied"),
		);

		openRestore.click();
		await waitForCondition(
			() =>
				(restoreDialog.open &&
					(backupTable.textContent ?? "").includes("Restore")) ||
				false,
		);

		const restoreButton = backupTable.querySelector<HTMLButtonElement>(
			'button[data-action="restore-backup"]',
		);
		if (!restoreButton) {
			throw new Error("Missing restore action");
		}

		restoreButton.click();
		await waitForCondition(() =>
			(getDriveStatus().textContent ?? "").includes("auth denied"),
		);

		interactiveAuthFails = false;
		restoreButton.click();
		await waitForCondition(() => {
			const text = getDriveStatus().textContent ?? "";
			return text.includes("Restore completed") || text.includes("Connected");
		});

		expect(mock.__storageData[STORAGE_KEYS.notes]).toEqual({
			restored: createNote(
				"restored",
				"Restored note",
				"Restored title",
				10,
				11,
			),
		});
		expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({
			theme: "light",
		});
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});
});
