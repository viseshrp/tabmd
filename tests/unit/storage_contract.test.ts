import { describe, expect, it } from "vitest";
import baseConfig from "../../wxt.config";
import { writeRetentionCount, updateLocalIndex } from "../../entrypoints/drive/drive_backup";
import { DRIVE_STORAGE_KEYS } from "../../entrypoints/drive/types";
import { writeAllNotes } from "../../entrypoints/shared/notes";
import { STORAGE_KEYS, writeSettings, type NoteRecord } from "../../entrypoints/shared/storage";
import { createMockChrome, setMockChrome } from "../helpers/mock_chrome";

async function readManifestPermissions(): Promise<string[]> {
	const manifestConfig = baseConfig.manifest;
	if (!manifestConfig || typeof manifestConfig === "function") {
		throw new Error("Expected a static manifest object in wxt.config.ts");
	}

	const manifest = await Promise.resolve(manifestConfig);
	if (
		!("permissions" in manifest) ||
		!Array.isArray(manifest.permissions) ||
		!manifest.permissions.every((permission) => typeof permission === "string")
	) {
		throw new Error("Expected manifest.permissions to be a string array");
	}

	return manifest.permissions;
}

describe("storage contract", () => {
	it("declares unlimited local storage in the manifest", async () => {
		const permissions = await readManifestPermissions();
		expect(permissions).toContain("storage");
		expect(permissions).toContain("unlimitedStorage");
	});

	it("stores notes, settings, and drive metadata in chrome.storage.local", async () => {
		const mock = createMockChrome();
		setMockChrome(mock);

		const localSetCalls: Array<Record<string, unknown>> = [];
		const originalLocalSet = mock.storage.local.set;
		mock.storage.local.set = async (payload) => {
			localSetCalls.push(payload);
			await originalLocalSet(payload);
		};

		const notes: Record<string, NoteRecord> = {
			"note-1": {
				id: "note-1",
				title: "Saved title",
				content: "# Saved body",
				createdAt: 1,
				modifiedAt: 2,
			},
		};

		await writeAllNotes(notes);
		await writeSettings({ theme: "dark" });
		await writeRetentionCount(10);
		await updateLocalIndex("install-1", [
			{
				fileId: "backup-1",
				fileName: "tabmd-backup-2026-03-09T13-42-14-254Z-n1",
				timestamp: 1700000000000,
				size: 123,
				noteCount: 1,
			},
		]);

		expect(localSetCalls).toEqual(
			expect.arrayContaining([
				{ [STORAGE_KEYS.notes]: notes },
				{ [STORAGE_KEYS.settings]: { theme: "dark" } },
				{ [DRIVE_STORAGE_KEYS.retentionCount]: 10 },
				{
					[DRIVE_STORAGE_KEYS.driveBackupIndex]: {
						installId: "install-1",
						backups: [
							{
								fileId: "backup-1",
								fileName: "tabmd-backup-2026-03-09T13-42-14-254Z-n1",
								timestamp: 1700000000000,
								size: 123,
								noteCount: 1,
							},
						],
					},
				},
			]),
		);

		expect(mock.__storageData[STORAGE_KEYS.notes]).toEqual(notes);
		expect(mock.__storageData[STORAGE_KEYS.settings]).toEqual({ theme: "dark" });
		expect(mock.__storageData[DRIVE_STORAGE_KEYS.retentionCount]).toBe(10);
		expect(mock.__storageData[DRIVE_STORAGE_KEYS.driveBackupIndex]).toEqual({
			installId: "install-1",
			backups: [
				{
					fileId: "backup-1",
					fileName: "tabmd-backup-2026-03-09T13-42-14-254Z-n1",
					timestamp: 1700000000000,
					size: 123,
					noteCount: 1,
				},
			],
		});
	});
});
