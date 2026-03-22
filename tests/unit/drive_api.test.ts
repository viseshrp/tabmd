import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteFile,
	downloadBinaryFile,
	downloadTextFile,
	getOrCreateFolder,
	listFiles,
	listFilesPage,
	uploadBinaryFile,
	uploadTextFile,
} from "../../entrypoints/drive/drive_api";

describe("drive api helpers", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("lists paginated files and preserves metadata", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: [{ id: "f1", name: "tabmd-backup-2026-03-09T13-42-14-254Z-n1" }],
						nextPageToken: "next-1",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: [{ id: "f1", name: "tabmd-backup-2026-03-09T13-42-14-254Z-n1" }],
						nextPageToken: "next-1",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: [{ id: "f2", name: "tabmd-backup-2026-03-08T13-42-14-254Z-n1" }],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		const firstPage = await listFilesPage("folder-1", "token-1");
		expect(firstPage.files).toEqual([
			{ id: "f1", name: "tabmd-backup-2026-03-09T13-42-14-254Z-n1" },
		]);
		expect(firstPage.nextPageToken).toBe("next-1");

		const allFiles = await listFiles("folder-1", "token-1");
		expect(allFiles).toEqual([
			{ id: "f1", name: "tabmd-backup-2026-03-09T13-42-14-254Z-n1" },
			{ id: "f2", name: "tabmd-backup-2026-03-08T13-42-14-254Z-n1" },
		]);
	});

	it("returns an existing folder id without creating a new folder", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ files: [{ id: "folder-1" }] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await expect(getOrCreateFolder("tabmd_backups", "token-1")).resolves.toBe(
			"folder-1",
		);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("creates a folder when no existing folder is found", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ files: [] }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: "folder-2" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			getOrCreateFolder("tabmd_backups", "token-1", "parent-1"),
		).resolves.toBe("folder-2");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("uploads and downloads markdown note files", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "file-1",
						name: "note-2026-03-09T13-42-14-254Z.md",
						size: "128",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response("# Markdown backup", {
					status: 200,
					headers: { "Content-Type": "text/markdown" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const uploaded = await uploadTextFile(
			"note-2026-03-09T13-42-14-254Z.md",
			"# Markdown backup",
			"text/markdown",
			"folder-1",
			"token-1",
		);
		expect(uploaded.id).toBe("file-1");
		const uploadBody = fetchMock.mock.calls[0]?.[1]?.body;
		const uploadBodyText =
			uploadBody instanceof Blob ? await uploadBody.text() : String(uploadBody);
		expect(uploadBodyText).toContain(
			"note-2026-03-09T13-42-14-254Z.md",
		);
		expect(uploadBodyText).toContain("text/markdown");

		await expect(downloadTextFile("file-1", "token-1")).resolves.toBe(
			"# Markdown backup",
		);
	});

	it("uploads and downloads zip backup files", async () => {
		const archiveBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "zip-file",
						name: "tabmd-backup-2026-03-10T16-36-45-645Z-n7.zip",
						size: "2048",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(archiveBytes, {
					status: 200,
					headers: { "Content-Type": "application/zip" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		const uploaded = await uploadBinaryFile(
			"tabmd-backup-2026-03-10T16-36-45-645Z-n7.zip",
			new Blob([archiveBytes], { type: "application/zip" }),
			"application/zip",
			"folder-1",
			"token-1",
		);
		expect(uploaded.id).toBe("zip-file");

		const uploadBody = fetchMock.mock.calls[0]?.[1]?.body;
		const uploadBodyText =
			uploadBody instanceof Blob ? await uploadBody.text() : String(uploadBody);
		expect(uploadBodyText).toContain(
			"tabmd-backup-2026-03-10T16-36-45-645Z-n7.zip",
		);
		expect(uploadBodyText).toContain("application/zip");

		const downloaded = new Uint8Array(
			await downloadBinaryFile("zip-file", "token-1"),
		);
		expect(downloaded).toEqual(archiveBytes);
	});

	it("ignores 404 deletes and throws on other failures", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(new Response("", { status: 404 }))
			.mockResolvedValueOnce(new Response("boom", { status: 500 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			deleteFile("missing-file", "token-1"),
		).resolves.toBeUndefined();
		await expect(deleteFile("bad-file", "token-1")).rejects.toThrow(
			"Drive delete file failed (500)",
		);
	});
});
