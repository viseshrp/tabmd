/**
 * Small ZIP helpers for Drive backups.
 * The archive format uses standard stored entries so backup creation and
 * restore stay linear in the total backup size without extra dependencies.
 */

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION_NEEDED = 20;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const MAX_END_OF_CENTRAL_DIRECTORY_SCAN = 65_557;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type BackupZipTextFile = {
	name: string;
	content: string;
	modifiedAt: number;
};

type PreparedZipEntry = {
	contentBytes: Uint8Array;
	crc32: number;
	fileNameBytes: Uint8Array;
	localHeaderOffset: number;
	localHeaderBytes: Uint8Array;
	modifiedAt: number;
	name: string;
};

type BackupZipBinaryEntry = {
	compressedSize: number;
	compressionMethod: number;
	contentBytes: Uint8Array;
	modifiedAt: number;
	name: string;
	uncompressedSize: number;
};

/** Precomputed lookup table keeps CRC calculation linear with a low constant factor. */
const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
	const table = new Uint32Array(256);
	for (let index = 0; index < table.length; index += 1) {
		let value = index;
		for (let bit = 0; bit < 8; bit += 1) {
			value =
				(value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[index] = value >>> 0;
	}
	return table;
}

/** ZIP timestamps use the DOS date/time bit layout rather than Unix epoch milliseconds. */
function encodeZipTimestamp(timestamp: number): { date: number; time: number } {
	const date = new Date(Number.isFinite(timestamp) ? timestamp : Date.now());
	const year = Math.min(Math.max(date.getUTCFullYear(), 1980), 2107);
	const month = date.getUTCMonth() + 1;
	const day = date.getUTCDate();
	const hours = date.getUTCHours();
	const minutes = date.getUTCMinutes();
	const seconds = Math.floor(date.getUTCSeconds() / 2);

	return {
		date: ((year - 1980) << 9) | (month << 5) | day,
		time: (hours << 11) | (minutes << 5) | seconds,
	};
}

/** CRC32 is required by the ZIP container even when entries are stored uncompressed. */
function calculateCrc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		const tableValue = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0;
		crc = tableValue ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function createLocalFileHeader(
	fileNameBytes: Uint8Array,
	contentBytes: Uint8Array,
	crc32: number,
	modifiedAt: number,
): Uint8Array {
	const header = new Uint8Array(30 + fileNameBytes.length);
	const view = new DataView(header.buffer);
	const timestamp = encodeZipTimestamp(modifiedAt);

	view.setUint32(0, ZIP_LOCAL_FILE_HEADER_SIGNATURE, true);
	view.setUint16(4, ZIP_VERSION_NEEDED, true);
	view.setUint16(6, ZIP_UTF8_FLAG, true);
	view.setUint16(8, ZIP_STORE_METHOD, true);
	view.setUint16(10, timestamp.time, true);
	view.setUint16(12, timestamp.date, true);
	view.setUint32(14, crc32, true);
	view.setUint32(18, contentBytes.length, true);
	view.setUint32(22, contentBytes.length, true);
	view.setUint16(26, fileNameBytes.length, true);
	view.setUint16(28, 0, true);
	header.set(fileNameBytes, 30);
	return header;
}

function createCentralDirectoryHeader(entry: PreparedZipEntry): Uint8Array {
	const header = new Uint8Array(46 + entry.fileNameBytes.length);
	const view = new DataView(header.buffer);
	const timestamp = encodeZipTimestamp(entry.modifiedAt);

	view.setUint32(0, ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE, true);
	view.setUint16(4, ZIP_VERSION_NEEDED, true);
	view.setUint16(6, ZIP_VERSION_NEEDED, true);
	view.setUint16(8, ZIP_UTF8_FLAG, true);
	view.setUint16(10, ZIP_STORE_METHOD, true);
	view.setUint16(12, timestamp.time, true);
	view.setUint16(14, timestamp.date, true);
	view.setUint32(16, entry.crc32, true);
	view.setUint32(20, entry.contentBytes.length, true);
	view.setUint32(24, entry.contentBytes.length, true);
	view.setUint16(28, entry.fileNameBytes.length, true);
	view.setUint16(30, 0, true);
	view.setUint16(32, 0, true);
	view.setUint16(34, 0, true);
	view.setUint16(36, 0, true);
	view.setUint32(38, 0, true);
	view.setUint32(42, entry.localHeaderOffset, true);
	header.set(entry.fileNameBytes, 46);
	return header;
}

function createEndOfCentralDirectory(
	entryCount: number,
	centralDirectorySize: number,
	centralDirectoryOffset: number,
): Uint8Array {
	const footer = new Uint8Array(22);
	const view = new DataView(footer.buffer);

	view.setUint32(0, ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
	view.setUint16(4, 0, true);
	view.setUint16(6, 0, true);
	view.setUint16(8, entryCount, true);
	view.setUint16(10, entryCount, true);
	view.setUint32(12, centralDirectorySize, true);
	view.setUint32(16, centralDirectoryOffset, true);
	view.setUint16(20, 0, true);
	return footer;
}

/**
 * Creates a ZIP blob from text files without materializing one giant output buffer.
 * Using `Blob` parts keeps memory overhead bounded while still producing one Drive upload.
 */
export function createBackupZip(files: readonly BackupZipTextFile[]): Blob {
	const preparedEntries: PreparedZipEntry[] = [];
	let nextOffset = 0;

	for (const file of files) {
		const fileNameBytes = textEncoder.encode(file.name);
		const contentBytes = textEncoder.encode(file.content);
		const crc32 = calculateCrc32(contentBytes);
		const localHeaderBytes = createLocalFileHeader(
			fileNameBytes,
			contentBytes,
			crc32,
			file.modifiedAt,
		);

		preparedEntries.push({
			contentBytes,
			crc32,
			fileNameBytes,
			localHeaderOffset: nextOffset,
			localHeaderBytes,
			modifiedAt: file.modifiedAt,
			name: file.name,
		});
		nextOffset += localHeaderBytes.length + contentBytes.length;
	}

	const centralDirectoryHeaders = preparedEntries.map(createCentralDirectoryHeader);
	const centralDirectorySize = centralDirectoryHeaders.reduce(
		(total, header) => total + header.length,
		0,
	);
	const endOfCentralDirectory = createEndOfCentralDirectory(
		preparedEntries.length,
		centralDirectorySize,
		nextOffset,
	);

	const parts: BlobPart[] = [];
	for (const entry of preparedEntries) {
		parts.push(
			copyBytesToArrayBuffer(entry.localHeaderBytes),
			copyBytesToArrayBuffer(entry.contentBytes),
		);
	}
	for (const centralDirectoryHeader of centralDirectoryHeaders) {
		parts.push(copyBytesToArrayBuffer(centralDirectoryHeader));
	}
	parts.push(copyBytesToArrayBuffer(endOfCentralDirectory));

	return new Blob(parts, { type: "application/zip" });
}

function findEndOfCentralDirectoryOffset(bytes: Uint8Array): number {
	const minimumOffset = Math.max(0, bytes.length - MAX_END_OF_CENTRAL_DIRECTORY_SCAN);
	for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
		if (
			bytes[offset] === 0x50 &&
			bytes[offset + 1] === 0x4b &&
			bytes[offset + 2] === 0x05 &&
			bytes[offset + 3] === 0x06
		) {
			return offset;
		}
	}
	return -1;
}

function readEntryContent(
	bytes: Uint8Array,
	entryOffset: number,
	compressedSize: number,
): Uint8Array {
	return bytes.slice(entryOffset, entryOffset + compressedSize);
}

/** Blob typing in TS expects plain `ArrayBuffer` chunks, so archive bytes are copied here once. */
function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const buffer = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(buffer).set(bytes);
	return buffer;
}

/** Reads the stored ZIP entries back out so restore can rebuild notes from one Drive file. */
export function extractBackupZipTextFiles(
	archiveBytes: ArrayBuffer,
): BackupZipTextFile[] {
	const bytes = new Uint8Array(archiveBytes);
	const endOffset = findEndOfCentralDirectoryOffset(bytes);
	if (endOffset < 0) {
		throw new Error("Backup archive is missing the ZIP directory footer.");
	}

	const endView = new DataView(
		bytes.buffer,
		bytes.byteOffset + endOffset,
		bytes.byteLength - endOffset,
	);
	const entryCount = endView.getUint16(10, true);
	const centralDirectoryOffset = endView.getUint32(16, true);
	const entries: BackupZipTextFile[] = [];

	let directoryOffset = centralDirectoryOffset;
	for (let index = 0; index < entryCount; index += 1) {
		const directoryView = new DataView(
			bytes.buffer,
			bytes.byteOffset + directoryOffset,
			bytes.byteLength - directoryOffset,
		);
		if (
			directoryView.getUint32(0, true) !==
			ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE
		) {
			throw new Error("Backup archive contains an invalid ZIP directory entry.");
		}

		const compressionMethod = directoryView.getUint16(10, true);
		const compressedSize = directoryView.getUint32(20, true);
		const uncompressedSize = directoryView.getUint32(24, true);
		const fileNameLength = directoryView.getUint16(28, true);
		const extraLength = directoryView.getUint16(30, true);
		const commentLength = directoryView.getUint16(32, true);
		const relativeOffsetOfLocalHeader = directoryView.getUint32(42, true);
		const fileNameBytes = bytes.slice(
			directoryOffset + 46,
			directoryOffset + 46 + fileNameLength,
		);
		const name = textDecoder.decode(fileNameBytes);

		const localView = new DataView(
			bytes.buffer,
			bytes.byteOffset + relativeOffsetOfLocalHeader,
			bytes.byteLength - relativeOffsetOfLocalHeader,
		);
		if (localView.getUint32(0, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
			throw new Error("Backup archive contains an invalid ZIP local header.");
		}

		const localFileNameLength = localView.getUint16(26, true);
		const localExtraLength = localView.getUint16(28, true);
		const dataOffset =
			relativeOffsetOfLocalHeader + 30 + localFileNameLength + localExtraLength;
		const entry: BackupZipBinaryEntry = {
			compressedSize,
			compressionMethod,
			contentBytes: readEntryContent(bytes, dataOffset, compressedSize),
			modifiedAt: Date.now(),
			name,
			uncompressedSize,
		};

		if (entry.compressionMethod !== ZIP_STORE_METHOD) {
			throw new Error(
				`Backup archive entry "${entry.name}" uses unsupported ZIP compression method ${entry.compressionMethod}.`,
			);
		}
		if (entry.contentBytes.length !== entry.uncompressedSize) {
			throw new Error(
				`Backup archive entry "${entry.name}" has an unexpected stored size.`,
			);
		}
		if (!entry.name.endsWith("/")) {
			entries.push({
				content: textDecoder.decode(entry.contentBytes),
				modifiedAt: entry.modifiedAt,
				name: entry.name,
			});
		}

		directoryOffset += 46 + fileNameLength + extraLength + commentLength;
	}

	return entries;
}
