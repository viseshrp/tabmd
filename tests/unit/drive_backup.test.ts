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

	it("serializes backup payloads and normalizes helper values", () => {
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
			{ theme: "dark" },
			"install-1",
			1700000000000,
		);

		expect(payload.version).toBe(BACKUP_VERSION);
		expect(payload.installId).toBe("install-1");
		expect(payload.timestamp).toBe(1700000000000);
		expect(Object.keys(payload.notes)).toEqual(["note-1"]);
		expect(payload.settings.theme).toBe("dark");

		const fileName = createBackupFileName(1700000000000, 4);
		expect(fileName).toContain("tabmd-backup-");
		expect(fileName).toContain("-n4.json");
		expect(extractNoteCountFromFileName(fileName)).toBe(4);
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
							fileName: "backup-a.json",
							timestamp: 10,
							size: 123,
							noteCount: 4,
						},
						{
							fileId: "",
							fileName: "invalid.json",
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
				fileName: "backup-b.json",
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

	it("handles retention read/write and trims old backups", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		expect(await readRetentionCount()).toBe(10);
		expect(await writeRetentionCount(2)).toBe(2);

		const deleted: string[] = [];
		const kept = await enforceRetention("folder-1", 2, "token-1", {
			listFiles: async () => [
				{
					id: "a",
					name: "backup-1-n2.json",
					createdTime: "2024-01-03T10:00:00.000Z",
					size: "10",
				},
				{
					id: "b",
					name: "backup-2-n1.json",
					createdTime: "2024-01-02T10:00:00.000Z",
					size: "10",
				},
				{
					id: "c",
					name: "backup-3-n1.json",
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

	it("lists backups, pages them, performs backup, and restores notes", async () => {
		const mock = createMockChrome({
			initialStorage: {
				[STORAGE_KEYS.settings]: { theme: "light" },
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
		setMockChrome(mock);

		const backups = await listDriveBackups("token-1", {
			getOrCreateFolder: async (name: string) => `${name}-id`,
			listFiles: async () => [
				{
					id: "f1",
					name: "backup-z-n5.json",
					createdTime: "2024-01-01T00:00:00.000Z",
					size: "42",
				},
			],
			uploadJsonFile: async () => {
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

		const page = await listDriveBackupsPage("token-1", undefined, 25, {
			getOrCreateFolder: async (name: string) => `${name}-id`,
			listFilesPage: async () => ({
				files: [
					{
						id: "f2",
						name: "backup-y-n2.json",
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

		const uploadedNames: string[] = [];
		const kept = await performBackup(
			"token-1",
			1,
			{
				getOrCreateFolder: async (name: string) => `${name}-id`,
				listFiles: async () => [
					{
						id: "new-file",
						name: "tabmd-backup-2024-01-03T00-00-00-000Z-n1.json",
						createdTime: "2024-01-03T00:00:00.000Z",
						size: "100",
					},
					{
						id: "old-file",
						name: "tabmd-backup-2024-01-01T00-00-00-000Z-n1.json",
						createdTime: "2024-01-01T00:00:00.000Z",
						size: "90",
					},
				],
				listFilesPage: async () => ({ files: [], nextPageToken: null }),
				uploadJsonFile: async (name) => {
					uploadedNames.push(name);
					return {
						id: "new-file",
						name,
						createdTime: "2024-01-03T00:00:00.000Z",
						size: "100",
					};
				},
				downloadJsonFile: async () => {
					throw new Error("not used");
				},
				deleteFile: async () => undefined,
			},
			{
				notes: {
					"note-1": {
						id: "note-1",
						content: "Hello",
						title: null,
						createdAt: 1,
						modifiedAt: 2,
					},
				},
			},
		);
		expect(uploadedNames[0]).toContain("tabmd-backup-");
		expect(kept).toHaveLength(1);

		const restored = await restoreFromBackup("file-1", "token-1", {
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
				settings: {
					theme: "dark",
				},
			}),
		});
		expect(restored.restoredNotes).toBe(1);
		expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({
			theme: "dark",
		});
	});

	it("uses local backups first and falls back to Drive when the cache is empty", async () => {
		const localMock = createMockChrome({
			initialStorage: {
				[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
					installId: "install-1",
					backups: [
						{
							fileId: "local",
							fileName: "backup-local.json",
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
				fileName: "backup-local.json",
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
						name: "backup-drive.json",
						createdTime: "2024-01-02T00:00:00.000Z",
						size: "9",
					},
				],
				listFilesPage: async () => ({ files: [], nextPageToken: null }),
				uploadJsonFile: async () => {
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
				fileName: "backup-drive.json",
				timestamp: Date.parse("2024-01-02T00:00:00.000Z"),
				size: 9,
				noteCount: 0,
			},
		]);
	});
});
