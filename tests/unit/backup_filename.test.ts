import { describe, expect, it } from "vitest";
import {
	createTabmdBackupFileName,
	extractNoteCountFromBackupFileName,
	formatBackupTimestampSegment,
	TABMD_BACKUP_FILE_PREFIX,
} from "../../entrypoints/shared/backup_filename";

describe("backup filename helpers", () => {
	it("creates canonical backup filenames with embedded note counts", () => {
		const name = createTabmdBackupFileName(
			Date.UTC(2026, 1, 23, 2, 20, 49, 747),
			12,
		);
		expect(name).toBe(
			`${TABMD_BACKUP_FILE_PREFIX}-2026-02-23T02-20-49-747Z-n12.json`,
		);
		expect(extractNoteCountFromBackupFileName(name)).toBe(12);
	});

	it("uses a Windows-safe timestamp segment and falls back to zero for unknown names", () => {
		expect(
			formatBackupTimestampSegment(Date.UTC(2026, 2, 7, 12, 30, 5, 9)),
		).toBe("2026-03-07T12-30-05-009Z");
		expect(extractNoteCountFromBackupFileName("foreign-backup.json")).toBe(0);
		expect(extractNoteCountFromBackupFileName("tabmd-backup-x-n0.json")).toBe(
			0,
		);
	});
});
