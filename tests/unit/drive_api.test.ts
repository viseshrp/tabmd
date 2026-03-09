import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteFile,
	downloadTextFile,
	downloadJsonFile,
	getOrCreateFolder,
	listFiles,
	listFilesPage,
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
						files: [{ id: "f1", name: "backup-a.json" }],
						nextPageToken: "next-1",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: [{ id: "f1", name: "backup-a.json" }],
						nextPageToken: "next-1",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: [{ id: "f2", name: "backup-b.json" }],
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);

		const firstPage = await listFilesPage("folder-1", "token-1");
		expect(firstPage.files).toEqual([{ id: "f1", name: "backup-a.json" }]);
		expect(firstPage.nextPageToken).toBe("next-1");

		const allFiles = await listFiles("folder-1", "token-1");
		expect(allFiles).toEqual([
			{ id: "f1", name: "backup-a.json" },
			{ id: "f2", name: "backup-b.json" },
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

	it("uploads text files and downloads both text and JSON payloads", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						id: "file-1",
						name: "tabmd-backup.json",
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
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ notes: {} }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
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
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
			"note-2026-03-09T13-42-14-254Z.md",
		);
		expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain(
			"text/markdown",
		);

		await expect(downloadTextFile("file-1", "token-1")).resolves.toBe(
			"# Markdown backup",
		);

		await expect(downloadJsonFile("file-1", "token-1")).resolves.toEqual({
			notes: {},
		});
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
