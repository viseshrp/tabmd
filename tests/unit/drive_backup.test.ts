import { describe, expect, it } from "vitest";
import {
	enforceRetention,
	getBackupsWithFallback,
	getOrCreateInstallId,
	listDriveBackups,
	listDriveBackupsPage,
	performBackup,
	readLocalIndex,
	readRetentionCount,
	restoreFromBackup,
	serializeBackup,
	updateLocalIndex,
	writeRetentionCount,
} from "../../entrypoints/drive/drive_backup";
import {
	BACKUP_VERSION,
	DRIVE_STORAGE_KEYS,
	createBackupFileName,
	extractNoteCountFromFileName,
	normalizeRetentionCount,
	parseDriveTimestamp,
} from "../../entrypoints/drive/types";
import { createNoteMarkdownFileName } from "../../entrypoints/shared/note_markdown";
import { STORAGE_KEYS } from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

describe("drive backup orchestration", () => {
	it("creates and reuses the install id", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		const generated = await getOrCreateInstallId();
		const second = await getOrCreateInstallId();

		expect(second).toBe(generated);
		expect(mock.__storageData[DRIVE_STORAGE_KEYS.installId]).toBe(generated);
	});

	it("serializes the legacy JSON payload and shared helper values", () => {
		const payload = serializeBackup(
			{
				"note-1": {
					id: "note-1",
					content: "Hello",
					title: null,
					createdAt: 1,
					modifiedAt: 2,
				},
			},
			"install-1",
			1700000000000,
		);

		expect(payload.version).toBe(BACKUP_VERSION);
		expect(payload.installId).toBe("install-1");
		expect(payload.timestamp).toBe(1700000000000);
		expect(Object.keys(payload.notes)).toEqual(["note-1"]);
		expect(createBackupFileName(1700000000000, 4)).toBe(
			"tabmd-backup-2023-11-14T22-13-20-000Z-n4",
		);
		expect(
			extractNoteCountFromFileName("tabmd-backup-2026-03-09T13-42-14-254Z-n4"),
		).toBe(4);
		expect(
			createNoteMarkdownFileName(
				"Test/Title:*?",
				"Content",
				Date.UTC(2026, 2, 9, 13, 42, 14, 254),
			),
		).toBe("Test-Title----2026-03-09T13-42-14-254Z.md");
		expect(normalizeRetentionCount(0)).toBe(1);
		expect(normalizeRetentionCount(9999)).toBe(500);
		expect(parseDriveTimestamp("invalid")).toBe(0);
	});

	it("reads and writes a normalized local backup index", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [
						{
							fileId: "f1",
							fileName: "tabmd-backup-a-n4",
							timestamp: 10,
							size: 123,
							noteCount: 4,
						},
						{
							fileId: "",
							fileName: "invalid",
							timestamp: 5,
							size: 1,
							noteCount: 1,
						},
					],
				},
			},
		});
		setMockChrome(mock);

		const read = await readLocalIndex();
		expect(read.installId).toBe("install-1");
		expect(read.backups).toHaveLength(1);

		await updateLocalIndex("install-1", [
			{
				fileId: "f2",
				fileName: "tabmd-backup-b-n2",
				timestamp: 20,
				size: 222,
				noteCount: 2,
			},
		]);

		const stored = mock.__storageData[DRIVE_STORAGE_KEYS.driveBackupIndex] as {
			installId: string;
			backups: Array<{ fileId: string }>;
		};
		expect(stored.installId).toBe("install-1");
		expect(stored.backups[0]?.fileId).toBe("f2");
	});

	it("handles retention read/write and trims old snapshots", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		expect(await readRetentionCount()).toBe(10);
		expect(await writeRetentionCount(2)).toBe(2);

		const deleted: string[] = [];
		const kept = await enforceRetention("folder-1", 2, "token-1", {
			listFiles: async () => [
				{
					id: "a",
					name: "tabmd-backup-2024-01-03T10-00-00-000Z-n2",
					createdTime: "2024-01-03T10:00:00.000Z",
					size: "10",
				},
				{
					id: "b",
					name: "tabmd-backup-2024-01-02T10-00-00-000Z-n1",
					createdTime: "2024-01-02T10:00:00.000Z",
					size: "10",
				},
				{
					id: "c",
					name: "tabmd-backup-2024-01-01T10-00-00-000Z-n1",
					createdTime: "2024-01-01T10:00:00.000Z",
					size: "10",
				},
			],
			deleteFile: async (fileId: string) => {
				deleted.push(fileId);
			},
		});

		expect(kept).toHaveLength(2);
		expect(deleted).toEqual(["c"]);
	});

	it("lists backups and resolves the shared root plus install subfolder path", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		setMockChrome(mock);

		const folderCalls: Array<{ name: string; parentId?: string }> = [];
		const backups = await listDriveBackups("token-1", {
			getOrCreateFolder: async (
				name: string,
				_token: string,
				parentId?: string,
			) => {
				folderCalls.push({ name, parentId });
				return `${name}-id`;
			},
			listFiles: async () => [
				{
					id: "f1",
					name: "tabmd-backup-2024-01-01T00-00-00-000Z-n5",
					createdTime: "2024-01-01T00:00:00.000Z",
					size: "42",
				},
			],
			listFilesPage: async () => ({ files: [], nextPageToken: null }),
			uploadTextFile: async () => {
				throw new Error("not used");
			},
			uploadJsonFile: async () => {
				throw new Error("not used");
			},
			downloadTextFile: async () => {
				throw new Error("not used");
			},
			downloadJsonFile: async () => {
				throw new Error("not used");
			},
			deleteFile: async () => {
				throw new Error("not used");
			},
		});

		expect(backups[0]?.fileId).toBe("f1");
		expect(folderCalls).toEqual([
			{ name: "tabmd_backups", parentId: undefined },
			{ name: "install-1", parentId: "tabmd_backups-id" },
		]);
	});

	it("lists restore pages using paged Drive metadata when available", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		setMockChrome(mock);

		const page = await listDriveBackupsPage("token-1", undefined, 25, {
			getOrCreateFolder: async (name: string) => `${name}-id`,
			listFilesPage: async () => ({
				files: [
					{
						id: "f2",
						name: "tabmd-backup-2024-01-02T00-00-00-000Z-n2",
						createdTime: "2024-01-02T00:00:00.000Z",
						size: "50",
					},
				],
				nextPageToken: "next-1",
			}),
			listFiles: async () => [],
		});

		expect(page.backups[0]?.fileId).toBe("f2");
		expect(page.nextPageToken).toBe("next-1");
	});

	it("falls back to the full list for the first page when paged listing is unavailable", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		setMockChrome(mock);

		const page = await listDriveBackupsPage("token-1", undefined, 25, {
			getOrCreateFolder: async (name: string) => `${name}-id`,
			listFiles: async () => [
				{
					id: "f1",
					name: "tabmd-backup-2024-01-01T00-00-00-000Z-n5",
					createdTime: "2024-01-01T00:00:00.000Z",
					size: "42",
				},
			],
		});

		expect(page.backups).toHaveLength(1);
		expect(page.nextPageToken).toBeNull();
	});

	it("returns an empty page for later pages when paged listing is unavailable", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		setMockChrome(mock);

		const page = await listDriveBackupsPage("token-1", "token-2", 25, {
			getOrCreateFolder: async (name: string) => `${name}-id`,
			listFiles: async () => {
				throw new Error("not used");
			},
		});

		expect(page.backups).toEqual([]);
		expect(page.nextPageToken).toBeNull();
	});

	it("performs a snapshot backup by uploading one markdown file per note", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.notes]: {
					"note-1": {
						id: "note-1",
						content: "Hello",
						title: "First",
						createdAt: 1,
						modifiedAt: 2,
					},
					"note-2": {
						id: "note-2",
						content: "World",
						title: null,
						createdAt: 3,
						modifiedAt: 4,
					},
				},
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
			},
		});
		setMockChrome(mock);

		const folderCalls: Array<{ name: string; parentId?: string }> = [];
		const uploadedFiles: Array<{
			name: string;
			content: string;
			folderId: string;
		}> = [];

		const kept = await performBackup(
			"token-1",
			1,
			{
				getOrCreateFolder: async (
					name: string,
					_token: string,
					parentId?: string,
				) => {
					folderCalls.push({ name, parentId });
					return `${name}-id`;
				},
				listFiles: async () => [
					{
						id: "tabmd-backup-2026-03-09T13-42-14-254Z-n2-id",
						name: "tabmd-backup-2026-03-09T13-42-14-254Z-n2",
						createdTime: "2026-03-09T13:42:14.254Z",
						size: "0",
					},
					{
						id: "old-snapshot",
						name: "tabmd-backup-2026-03-08T13-42-14-254Z-n1",
						createdTime: "2026-03-08T13:42:14.254Z",
						size: "0",
					},
				],
				listFilesPage: async () => ({ files: [], nextPageToken: null }),
				uploadTextFile: async (name, content, _mimeType, folderId) => {
					uploadedFiles.push({ name, content, folderId });
					return {
						id: `${name}-id`,
						name,
						modifiedTime: "2026-03-09T13:42:14.254Z",
					};
				},
				uploadJsonFile: async () => {
					throw new Error("not used");
				},
				downloadTextFile: async () => {
					throw new Error("not used");
				},
				downloadJsonFile: async () => {
					throw new Error("not used");
				},
				deleteFile: async () => undefined,
			},
			{
				notes: mock.__storageData[STORAGE_KEYS.notes] as Record<
					string,
					unknown
				> as Record<
					string,
					{
						id: string;
						content: string;
						title: string | null;
						createdAt: number;
						modifiedAt: number;
					}
				>,
			},
		);

		expect(folderCalls[0]).toEqual({
			name: "tabmd_backups",
			parentId: undefined,
		});
		expect(folderCalls[1]).toEqual({
			name: "install-1",
			parentId: "tabmd_backups-id",
		});
		expect(folderCalls[2]?.name).toMatch(/^tabmd-backup-.*-n2$/);
		expect(folderCalls[2]?.parentId).toBe("install-1-id");
		expect(uploadedFiles).toHaveLength(2);
		expect(uploadedFiles[0]?.name).toMatch(/\.md$/);
		expect(uploadedFiles[0]?.content).toContain("tabmd-id");
		expect(kept).toHaveLength(1);
	});

	it("restores notes from a markdown snapshot folder", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "light" },
			},
		});
		setMockChrome(mock);

		const restored = await restoreFromBackup(
			"snapshot-folder",
			"token-1",
			"tabmd-backup-2026-03-09T13-42-14-254Z-n2",
			{
				listFiles: async () => [
					{
						id: "f1",
						name: "First-2026-03-09T13-42-14-254Z.md",
						createdTime: "2026-03-09T13:42:14.254Z",
					},
					{
						id: "f2",
						name: "Second-2026-03-09T13-42-14-254Z.md",
						createdTime: "2026-03-09T13:42:14.254Z",
					},
				],
				downloadTextFile: async (fileId: string) => {
					if (fileId === "f1") {
						return [
							"---",
							"tabmd-version: 1",
							'tabmd-id: "note-1"',
							'tabmd-title: "Manual"',
							"tabmd-created-at: 10",
							"tabmd-modified-at: 11",
							"---",
							"",
							"# First",
						].join("\n");
					}
					return [
						"---",
						"tabmd-version: 1",
						'tabmd-id: "note-2"',
						"tabmd-title: null",
						"tabmd-created-at: 12",
						"tabmd-modified-at: 13",
						"---",
						"",
						"Second",
					].join("\n");
				},
				downloadJsonFile: async () => {
					throw new Error("not used");
				},
			},
		);

		expect(restored.restoredNotes).toBe(2);
		expect(
			(
				mock.__storageData[STORAGE_KEYS.notes] as Record<string, { id: string }>
			)["note-1"]?.id,
		).toBe("note-1");
		expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({
			theme: "light",
		});
	});

	it("restores legacy JSON snapshots for backward compatibility", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		const restored = await restoreFromBackup(
			"legacy-file",
			"token-1",
			"tabmd-backup-2026-03-09T13-42-14-254Z-n1.json",
			{
				listFiles: async () => [],
				downloadTextFile: async () => {
					throw new Error("not used");
				},
				downloadJsonFile: async () => ({
					notes: {
						"note-2": {
							id: "note-2",
							content: "Restored",
							title: "Restored title",
							createdAt: 10,
							modifiedAt: 11,
						},
					},
				}),
			},
		);

		expect(restored.restoredNotes).toBe(1);
	});

	it("uses local backups first and falls back to Drive when the cache is empty", async () => {
		const localMock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [
						{
							fileId: "local",
							fileName: "tabmd-backup-local-n1",
							timestamp: 2,
							size: 1,
							noteCount: 1,
						},
					],
				},
			},
		});
		setMockChrome(localMock);
		await expect(getBackupsWithFallback("token-1")).resolves.toEqual([
			{
				fileId: "local",
				fileName: "tabmd-backup-local-n1",
				timestamp: 2,
				size: 1,
				noteCount: 1,
			},
		]);

		const fallbackMock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.installId]: "install-1",
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [],
				},
			},
		});
		setMockChrome(fallbackMock);

		await expect(
			getBackupsWithFallback("token-1", {
				getOrCreateFolder: async (name: string) => `${name}-id`,
				listFiles: async () => [
					{
						id: "drive-1",
						name: "tabmd-backup-2024-01-02T00-00-00-000Z-n1",
						createdTime: "2024-01-02T00:00:00.000Z",
						size: "9",
					},
				],
				listFilesPage: async () => ({ files: [], nextPageToken: null }),
				uploadTextFile: async () => {
					throw new Error("not used");
				},
				uploadJsonFile: async () => {
					throw new Error("not used");
				},
				downloadTextFile: async () => {
					throw new Error("not used");
				},
				downloadJsonFile: async () => {
					throw new Error("not used");
				},
				deleteFile: async () => {
					throw new Error("not used");
				},
			}),
		).resolves.toEqual([
			{
				fileId: "drive-1",
				fileName: "tabmd-backup-2024-01-02T00-00-00-000Z-n1",
				timestamp: Date.parse("2024-01-02T00:00:00.000Z"),
				size: 9,
				noteCount: 1,
			},
		]);
	});

	it("returns an empty fallback list when Drive listing fails", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [],
				},
			},
		});
		setMockChrome(mock);

		await expect(
			getBackupsWithFallback("token-1", {
				getOrCreateFolder: async () => {
					throw new Error("fail");
				},
				listFiles: async () => [],
				listFilesPage: async () => ({ files: [], nextPageToken: null }),
				uploadTextFile: async () => {
					throw new Error("not used");
				},
				uploadJsonFile: async () => {
					throw new Error("not used");
				},
				downloadTextFile: async () => {
					throw new Error("not used");
				},
				downloadJsonFile: async () => {
					throw new Error("not used");
				},
				deleteFile: async () => {
					throw new Error("not used");
				},
			}),
		).resolves.toEqual([]);
	});

	it("throws on malformed legacy restore payloads", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		await expect(
			restoreFromBackup(
				"file-1",
				"token-1",
				"tabmd-backup-2026-03-09T13-42-14-254Z-n1.json",
				{
					listFiles: async () => [],
					downloadTextFile: async () => {
						throw new Error("not used");
					},
					downloadJsonFile: async () => "invalid",
				},
			),
		).rejects.toThrow("Backup payload is not an object.");
	});
});
