import { describe, expect, it } from "vitest";
import {
	createBackupZip,
	extractBackupZipTextFiles,
} from "../../entrypoints/shared/backup_zip";

describe("backup zip helpers", () => {
	it("round-trips markdown files through one zip archive", async () => {
		const archive = createBackupZip([
			{
				name: "First-2026-03-09T13-42-14-254Z.md",
				content: "# First",
				modifiedAt: Date.UTC(2026, 2, 9, 13, 42, 14, 254),
			},
			{
				name: "Second-2026-03-09T13-42-14-254Z.md",
				content: "Second body",
				modifiedAt: Date.UTC(2026, 2, 9, 13, 42, 14, 255),
			},
		]);

		const extracted = extractBackupZipTextFiles(await archive.arrayBuffer());
		expect(extracted).toHaveLength(2);
		expect(extracted[0]?.name).toBe("First-2026-03-09T13-42-14-254Z.md");
		expect(extracted[0]?.content).toBe("# First");
		expect(extracted[1]?.name).toBe("Second-2026-03-09T13-42-14-254Z.md");
		expect(extracted[1]?.content).toBe("Second body");
	});

	it("rejects archives that do not contain a valid zip footer", () => {
		expect(() =>
			extractBackupZipTextFiles(new Uint8Array([1, 2, 3]).buffer),
		).toThrow("ZIP directory footer");
	});
});
