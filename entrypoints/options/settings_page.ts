import { createSnackbarNotifier, type UiNotifier } from "../ui/notifications";
import { deleteFile } from "../drive/drive_api";
import {
	formatDriveAuthError,
	getAuthToken,
	getAuthTokenSilently,
	removeCachedAuthToken,
	revokeToken,
} from "../drive/auth";
import {
	listDriveBackupsPage,
	performBackup,
	readRetentionCount,
	restoreFromBackup,
	writeRetentionCount,
} from "../drive/drive_backup";
import { normalizeRetentionCount, type DriveBackupEntry } from "../drive/types";
import { readAllNotes } from "../shared/notes";
import {
	readSettings,
	writeSettings,
	type TabmdSettings,
	type ThemeMode,
} from "../shared/storage";
import { logExtensionError } from "../shared/utils";

/**
 * Document-scoped notifier cache.
 * This keeps all settings-page status messaging flowing through the same snackbar instance.
 */
type DocumentToastNotifierCache = {
	snackbarEl: HTMLDivElement | null;
	notifier: UiNotifier;
};

const toastNotifierByDocument = new WeakMap<
	Document,
	DocumentToastNotifierCache
>();

/** Resolves or creates the snackbar-backed notifier for a given document. */
function resolveDocumentToastNotifier(documentRef: Document): UiNotifier {
	const snackbarEl = documentRef.querySelector<HTMLDivElement>("#snackbar");
	const cached = toastNotifierByDocument.get(documentRef);
	if (cached && cached.snackbarEl === snackbarEl) {
		return cached.notifier;
	}

	const notifier = createSnackbarNotifier(snackbarEl);
	toastNotifierByDocument.set(documentRef, { snackbarEl, notifier });
	return notifier;
}

/** Writes a status message through the shared snackbar for the current document. */
export function setStatus(
	statusEl: HTMLDivElement | null,
	message: string,
): void {
	const ownerDocument = statusEl?.ownerDocument ?? document;
	if (statusEl) {
		statusEl.textContent = message;
	}
	const notifier = resolveDocumentToastNotifier(ownerDocument);
	notifier.notify(message);
}

// Theme changes are reflected on the root element so the shared design tokens update immediately.
function applyThemeToPage(documentRef: Document, theme: ThemeMode): void {
	if (theme === "os") {
		documentRef.documentElement.removeAttribute("data-theme");
		return;
	}

	documentRef.documentElement.setAttribute("data-theme", theme);
}

/** Formats epoch-ms timestamps into locale-friendly strings for restore rows. */
function formatBackupTimestamp(timestamp: number): string {
	if (!Number.isFinite(timestamp) || timestamp <= 0) {
		return "Unknown";
	}

	return new Date(timestamp).toLocaleString();
}

/** Formats byte counts for backup rows without pulling in any additional dependencies. */
function formatBytes(size: number): string {
	if (!Number.isFinite(size) || size <= 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB"];
	let value = size;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	const rounded =
		value >= 10 || unitIndex === 0
			? Math.round(value)
			: Math.round(value * 10) / 10;
	return `${rounded} ${units[unitIndex]}`;
}

/** Renders the Drive backup table body from the current page of backup metadata. */
function renderDriveBackups(
	listEl: HTMLTableSectionElement | null,
	backups: DriveBackupEntry[],
): void {
	if (!listEl) {
		return;
	}

	if (backups.length === 0) {
		const emptyRow = document.createElement("tr");
		const emptyCell = document.createElement("td");
		emptyCell.className = "row-empty";
		emptyCell.colSpan = 4;
		emptyCell.textContent = "No backups found yet.";
		emptyRow.appendChild(emptyCell);
		listEl.replaceChildren(emptyRow);
		return;
	}

	const rowNodes = backups.map((entry) => {
		const row = document.createElement("tr");

		const whenCell = document.createElement("td");
		whenCell.textContent = formatBackupTimestamp(entry.timestamp);
		row.appendChild(whenCell);

		const notesCell = document.createElement("td");
		notesCell.textContent = String(entry.noteCount);
		row.appendChild(notesCell);

		const sizeCell = document.createElement("td");
		sizeCell.textContent = formatBytes(entry.size);
		row.appendChild(sizeCell);

		const actionsCell = document.createElement("td");
		actionsCell.className = "row-actions";

		const restoreButton = document.createElement("button");
		restoreButton.type = "button";
		restoreButton.dataset.action = "restore-backup";
		restoreButton.dataset.fileId = entry.fileId;
		restoreButton.textContent = "Restore";
		actionsCell.appendChild(restoreButton);

		const deleteButton = document.createElement("button");
		deleteButton.type = "button";
		deleteButton.className = "danger";
		deleteButton.dataset.action = "delete-backup";
		deleteButton.dataset.fileId = entry.fileId;
		deleteButton.textContent = "Delete";
		actionsCell.appendChild(deleteButton);

		row.appendChild(actionsCell);
		return row;
	});

	listEl.replaceChildren(...rowNodes);
}

/**
 * Initializes the optional Google Drive backup section.
 * The section stays isolated so missing Drive-specific DOM never breaks core theme settings.
 */
async function initDriveBackupSection(documentRef: Document): Promise<void> {
	const DEFAULT_RESTORE_LIST_PAGE_SIZE = 5;
	const driveSectionEl =
		documentRef.querySelector<HTMLElement>(".drive-backup");
	const openAuthEl =
		documentRef.querySelector<HTMLButtonElement>("#openDriveAuth");
	const backupNowEl =
		documentRef.querySelector<HTMLButtonElement>("#backupNow");
	const openRestoreEl =
		documentRef.querySelector<HTMLButtonElement>("#openDriveRestore");
	const retentionEl = documentRef.querySelector<HTMLInputElement>(
		"#driveRetentionCount",
	);
	const backupListEl =
		documentRef.querySelector<HTMLTableSectionElement>("#driveBackupList");
	const restorePageSizeEl = documentRef.querySelector<HTMLSelectElement>(
		"#driveRestorePageSize",
	);
	const previousBackupsPageEl = documentRef.querySelector<HTMLButtonElement>(
		"#previousDriveBackupsPage",
	);
	const nextBackupsPageEl = documentRef.querySelector<HTMLButtonElement>(
		"#nextDriveBackupsPage",
	);
	const driveStatusEl =
		documentRef.querySelector<HTMLDivElement>("#driveStatus");
	const driveRestoreDialogEl = documentRef.querySelector<HTMLDialogElement>(
		"#driveRestoreDialog",
	);
	const closeDriveRestoreEl =
		documentRef.querySelector<HTMLButtonElement>("#closeDriveRestore");

	if (
		!openAuthEl ||
		!backupNowEl ||
		!openRestoreEl ||
		!retentionEl ||
		!backupListEl ||
		!restorePageSizeEl ||
		!previousBackupsPageEl ||
		!nextBackupsPageEl ||
		!driveRestoreDialogEl ||
		!closeDriveRestoreEl
	) {
		return;
	}

	type DriveBusyReason =
		| "loading"
		| "connecting"
		| "disconnecting"
		| "backup"
		| "loading_restore_list"
		| "loading_more_restore_list"
		| "deleting_backup"
		| "restore"
		| null;

	let busyReason: DriveBusyReason = null;
	let isConnected = false;
	let currentToken: string | null = null;
	let currentPageBackups: DriveBackupEntry[] = [];
	let currentPageToken: string | null = null;
	let nextPageToken: string | null = null;

	// The root page is represented with an empty-string sentinel so backward pagination stays explicit.
	let previousPageTokens: string[] = [];

	const getRestoreListPageSize = (): number => {
		const parsed = Number(restorePageSizeEl.value);
		if (!Number.isFinite(parsed)) {
			return DEFAULT_RESTORE_LIST_PAGE_SIZE;
		}

		const normalized = Math.floor(parsed);
		return normalized > 0 ? normalized : DEFAULT_RESTORE_LIST_PAGE_SIZE;
	};

	const setRestoreButtonsDisabled = (disabled: boolean): void => {
		const actionButtons = backupListEl.querySelectorAll<HTMLButtonElement>(
			"button[data-action]",
		);
		for (const actionButton of actionButtons) {
			actionButton.disabled = disabled;
		}
	};

	const getConnectButtonLabel = (): string => {
		if (busyReason === "loading") {
			return "Checking Google Drive...";
		}
		if (busyReason === "connecting") {
			return "Connecting to Google Drive...";
		}
		if (busyReason === "disconnecting") {
			return "Disconnecting Google Drive...";
		}
		if (isConnected) {
			return "Connected to Google Drive (Disconnect)";
		}
		return "Connect to Google Drive";
	};

	const getBackupButtonLabel = (): string => {
		if (busyReason === "backup") {
			return "Backing up...";
		}
		return "Backup now";
	};

	const getRestoreButtonLabel = (): string => {
		if (busyReason === "loading_restore_list") {
			return "Loading backups...";
		}
		if (busyReason === "restore") {
			return "Restoring...";
		}
		return "Restore from backup";
	};

	const openRestoreDialog = (): void => {
		if (typeof driveRestoreDialogEl.showModal === "function") {
			driveRestoreDialogEl.showModal();
			return;
		}

		driveRestoreDialogEl.setAttribute("open", "");
	};

	const closeRestoreDialog = (): void => {
		if (typeof driveRestoreDialogEl.close === "function") {
			driveRestoreDialogEl.close();
			return;
		}

		driveRestoreDialogEl.removeAttribute("open");
	};

	const resolveConnectedToken = async (): Promise<string> => {
		if (currentToken) {
			return currentToken;
		}

		const token = await getAuthToken(true);
		currentToken = token;
		isConnected = true;
		return token;
	};

	/**
	 * Centralized UI-state application keeps button state changes deterministic.
	 * That matters here because connection, backup, pagination, and restore can all overlap logically.
	 */
	const applyDriveUiState = (): void => {
		const busy = busyReason !== null;
		openAuthEl.textContent = getConnectButtonLabel();
		openAuthEl.disabled = busy;
		openAuthEl.dataset.connected = isConnected ? "true" : "false";
		openAuthEl.dataset.busy = busy ? "true" : "false";

		backupNowEl.disabled = busy || !isConnected;
		backupNowEl.textContent = getBackupButtonLabel();

		openRestoreEl.disabled = busy || !isConnected;
		openRestoreEl.textContent = getRestoreButtonLabel();

		retentionEl.disabled = busy;
		restorePageSizeEl.disabled = busy;
		setRestoreButtonsDisabled(busy || !isConnected);

		previousBackupsPageEl.disabled =
			busy || !isConnected || previousPageTokens.length === 0;
		nextBackupsPageEl.disabled = busy || !isConnected || nextPageToken === null;
		previousBackupsPageEl.textContent = "Previous";
		nextBackupsPageEl.textContent = "Next";

		if (!driveSectionEl) {
			return;
		}

		driveSectionEl.setAttribute("aria-busy", busy ? "true" : "false");
		driveSectionEl.dataset.connected = isConnected ? "true" : "false";
	};

	const setBusyReason = (nextBusyReason: DriveBusyReason): void => {
		busyReason = nextBusyReason;
		applyDriveUiState();
	};

	const refreshAuthState = async (): Promise<void> => {
		const token = await getAuthTokenSilently();
		currentToken = token;
		isConnected = Boolean(token);
		applyDriveUiState();
	};

	const applyRestorePage = (
		pageBackups: DriveBackupEntry[],
		pageToken: string | null,
		nextToken: string | null,
	): void => {
		currentPageBackups = pageBackups;
		currentPageToken = pageToken;
		nextPageToken = nextToken;
		renderDriveBackups(backupListEl, currentPageBackups);
	};

	const setCurrentPageStatus = (): void => {
		if (currentPageBackups.length === 0) {
			setStatus(
				driveStatusEl,
				"No backups found. Create a backup first, then restore it here.",
			);
			return;
		}

		setStatus(
			driveStatusEl,
			`Showing ${currentPageBackups.length} backup${currentPageBackups.length === 1 ? "" : "s"} on this page.`,
		);
	};

	const reloadCurrentRestorePageForSelectedSize = async (): Promise<void> => {
		const token = await resolveConnectedToken();
		const targetPageToken = currentPageToken ?? undefined;
		const page = await listDriveBackupsPage(
			token,
			targetPageToken,
			getRestoreListPageSize(),
		);
		previousPageTokens = [];
		applyRestorePage(page.backups, currentPageToken, page.nextPageToken);
		setCurrentPageStatus();
	};

	const retention = await readRetentionCount();
	retentionEl.value = String(retention);

	openAuthEl.addEventListener("click", () => {
		void (async () => {
			try {
				if (!isConnected) {
					setBusyReason("connecting");
					setStatus(driveStatusEl, "Opening Google authentication...");
					currentToken = await getAuthToken(true);
					isConnected = true;
					setStatus(
						driveStatusEl,
						"Connected to Google Drive. You can back up or restore now.",
					);
					return;
				}

				setBusyReason("disconnecting");
				if (currentToken) {
					await removeCachedAuthToken(currentToken);
					await revokeToken(currentToken);
				}
				currentToken = null;
				isConnected = false;
				setStatus(
					driveStatusEl,
					"Disconnected from Google Drive. Connect again to back up or restore.",
				);
			} catch (error) {
				const fallback = isConnected
					? "Failed to disconnect from Google Drive."
					: "Failed to connect to Google Drive.";
				const message = formatDriveAuthError(error, fallback);
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				await refreshAuthState();
			}
		})();
	});

	retentionEl.addEventListener("change", () => {
		void (async () => {
			const normalized = normalizeRetentionCount(Number(retentionEl.value));
			const saved = await writeRetentionCount(normalized);
			retentionEl.value = String(saved);
			setStatus(
				driveStatusEl,
				`Retention saved: keep latest ${saved} backup${saved === 1 ? "" : "s"}.`,
			);
		})().catch((error) => {
			logExtensionError("Failed to save Drive retention setting", error, {
				operation: "runtime_context",
			});
			setStatus(driveStatusEl, "Failed to save retention setting.");
		});
	});

	backupNowEl.addEventListener("click", () => {
		void (async () => {
			setBusyReason("backup");
			setStatus(driveStatusEl, "Starting backup...");

			try {
				const token = await getAuthToken(true);
				currentToken = token;
				isConnected = true;

				// Empty snapshots are not useful, so the upload is skipped when no notes exist yet.
				const notes = await readAllNotes();
				const noteCount = Object.keys(notes).length;
				if (noteCount === 0) {
					setStatus(driveStatusEl, "Nothing to backup.");
					return;
				}

				const retentionCount = await writeRetentionCount(
					normalizeRetentionCount(Number(retentionEl.value)),
				);
				const backups = await performBackup(token, retentionCount, undefined, {
					notes,
				});
				retentionEl.value = String(retentionCount);
				setStatus(
					driveStatusEl,
					`Backup completed. ${backups.length} backup${backups.length === 1 ? "" : "s"} stored.`,
				);
			} catch (error) {
				const message = formatDriveAuthError(error, "Backup failed.");
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				await refreshAuthState();
			}
		})();
	});

	// The restore list is fetched lazily so the options page does not pay the network cost on initial load.
	openRestoreEl.addEventListener("click", () => {
		void (async () => {
			setBusyReason("loading_restore_list");
			setStatus(driveStatusEl, "Loading backups...");
			try {
				const token = await resolveConnectedToken();
				const page = await listDriveBackupsPage(
					token,
					undefined,
					getRestoreListPageSize(),
				);
				previousPageTokens = [];
				applyRestorePage(page.backups, null, page.nextPageToken);
				applyDriveUiState();
				openRestoreDialog();
				setCurrentPageStatus();
			} catch (error) {
				const message = formatDriveAuthError(
					error,
					"Failed to load backup list.",
				);
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				await refreshAuthState();
			}
		})();
	});

	nextBackupsPageEl.addEventListener("click", () => {
		void (async () => {
			if (!nextPageToken) {
				return;
			}

			setBusyReason("loading_more_restore_list");
			setStatus(driveStatusEl, "Loading next page...");
			try {
				const token = await resolveConnectedToken();
				previousPageTokens = [...previousPageTokens, currentPageToken ?? ""];
				const targetPageToken = nextPageToken;
				const page = await listDriveBackupsPage(
					token,
					targetPageToken,
					getRestoreListPageSize(),
				);
				applyRestorePage(page.backups, targetPageToken, page.nextPageToken);
				setCurrentPageStatus();
			} catch (error) {
				const message = formatDriveAuthError(
					error,
					"Failed to load next page.",
				);
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				applyDriveUiState();
				await refreshAuthState();
			}
		})();
	});

	previousBackupsPageEl.addEventListener("click", () => {
		void (async () => {
			if (previousPageTokens.length === 0) {
				return;
			}

			setBusyReason("loading_more_restore_list");
			setStatus(driveStatusEl, "Loading previous page...");
			try {
				const token = await resolveConnectedToken();
				const previousPageToken = previousPageTokens.pop() ?? "";
				const resolvedPreviousPageToken =
					previousPageToken.length > 0 ? previousPageToken : undefined;
				const page = await listDriveBackupsPage(
					token,
					resolvedPreviousPageToken,
					getRestoreListPageSize(),
				);
				applyRestorePage(
					page.backups,
					resolvedPreviousPageToken ?? null,
					page.nextPageToken,
				);
				setCurrentPageStatus();
			} catch (error) {
				const message = formatDriveAuthError(
					error,
					"Failed to load previous page.",
				);
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				applyDriveUiState();
				await refreshAuthState();
			}
		})();
	});

	restorePageSizeEl.addEventListener("change", () => {
		void (async () => {
			if (!driveRestoreDialogEl.open) {
				return;
			}

			setBusyReason("loading_restore_list");
			setStatus(driveStatusEl, "Updating page size...");
			try {
				await reloadCurrentRestorePageForSelectedSize();
			} catch (error) {
				const message = formatDriveAuthError(
					error,
					"Failed to update restore page size.",
				);
				setStatus(driveStatusEl, message);
			} finally {
				setBusyReason(null);
				applyDriveUiState();
				await refreshAuthState();
			}
		})();
	});

	closeDriveRestoreEl.addEventListener("click", () => {
		closeRestoreDialog();
	});

	backupListEl.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof HTMLElement)) {
			return;
		}

		const button = target.closest<HTMLButtonElement>("button[data-action]");
		if (!button) {
			return;
		}

		const fileId = button.dataset.fileId;
		if (!fileId) {
			return;
		}

		if (button.dataset.action === "restore-backup") {
			void (async () => {
				setBusyReason("restore");
				setStatus(driveStatusEl, "Restoring backup...");

				try {
					const token = await getAuthToken(true);
					currentToken = token;
					isConnected = true;
					const restored = await restoreFromBackup(fileId, token);
					closeRestoreDialog();
					setStatus(
						driveStatusEl,
						`Restore completed. ${restored.restoredNotes} note${restored.restoredNotes === 1 ? "" : "s"} restored.`,
					);
				} catch (error) {
					const message = formatDriveAuthError(error, "Restore failed.");
					setStatus(driveStatusEl, message);
				} finally {
					setBusyReason(null);
					await refreshAuthState();
				}
			})();
			return;
		}

		if (button.dataset.action === "delete-backup") {
			void (async () => {
				setBusyReason("deleting_backup");
				setStatus(driveStatusEl, "Deleting backup...");

				try {
					/**
					 * Delete removes only the chosen Drive file.
					 * Updating the currently visible page in place keeps the UI fast and avoids unnecessary refetches.
					 */
					const token = await resolveConnectedToken();
					await deleteFile(fileId, token);
					currentPageBackups = currentPageBackups.filter(
						(entry) => entry.fileId !== fileId,
					);

					// If the current page becomes empty, jump back one page so the dialog never strands users on a blank page.
					if (currentPageBackups.length === 0 && currentPageToken !== null) {
						setStatus(driveStatusEl, "Loading previous page...");
						const previousPageToken = previousPageTokens.pop() ?? "";
						const resolvedPreviousPageToken =
							previousPageToken.length > 0 ? previousPageToken : undefined;
						const page = await listDriveBackupsPage(
							token,
							resolvedPreviousPageToken,
							getRestoreListPageSize(),
						);
						applyRestorePage(
							page.backups,
							resolvedPreviousPageToken ?? null,
							page.nextPageToken,
						);
						setCurrentPageStatus();
						return;
					}

					renderDriveBackups(backupListEl, currentPageBackups);
					setCurrentPageStatus();
				} catch (error) {
					const message = formatDriveAuthError(error, "Delete failed.");
					setStatus(driveStatusEl, message);
				} finally {
					setBusyReason(null);
					applyDriveUiState();
					await refreshAuthState();
				}
			})();
		}
	});

	const refreshAuthStateOnVisibility = (): void => {
		void refreshAuthState();
	};

	documentRef.addEventListener(
		"visibilitychange",
		refreshAuthStateOnVisibility,
	);
	if (typeof window !== "undefined") {
		window.addEventListener("focus", refreshAuthStateOnVisibility);
	}

	setBusyReason("loading");
	setStatus(driveStatusEl, "Checking Google Drive connection...");
	previousPageTokens = [];
	applyRestorePage([], null, null);
	await refreshAuthState();
	setBusyReason(null);

	if (!isConnected) {
		setStatus(
			driveStatusEl,
			"Not connected. Connect Google Drive to back up or restore.",
		);
		return;
	}

	setStatus(
		driveStatusEl,
		"Connected to Google Drive. Ready to back up or restore.",
	);
}

/**
 * Initializes the settings page:
 * read persisted settings, wire the theme radios, and attach the optional Drive controls.
 */
export async function initSettingsPage(
	documentRef: Document = document,
): Promise<void> {
	try {
		const themeRadios = Array.from(
			documentRef.querySelectorAll<HTMLInputElement>('input[name="theme"]'),
		);
		if (themeRadios.length === 0) {
			return;
		}

		let currentSettings = await readSettings();

		const syncThemeControls = (theme: ThemeMode): void => {
			for (const radio of themeRadios) {
				radio.checked = radio.value === theme;
			}
			applyThemeToPage(documentRef, theme);
		};

		const saveCurrentSettings = async (
			newSettingsContent: Partial<TabmdSettings>,
		): Promise<void> => {
			try {
				const updated = { ...currentSettings, ...newSettingsContent };
				await writeSettings(updated);
				currentSettings = updated;
				syncThemeControls(currentSettings.theme);
				setStatus(
					documentRef.querySelector<HTMLDivElement>("#snackbar"),
					"Settings saved",
				);
			} catch (err: unknown) {
				logExtensionError("Failed to save settings", err, "options_page");
				setStatus(
					documentRef.querySelector<HTMLDivElement>("#snackbar"),
					"Failed to save settings.",
				);
			}
		};

		syncThemeControls(currentSettings.theme);

		// The radios are initialized once, then each handler writes only when its option becomes selected.
		for (const radio of themeRadios) {
			radio.addEventListener("change", () => {
				if (radio.checked) {
					void saveCurrentSettings({ theme: radio.value as ThemeMode });
				}
			});
		}

		await initDriveBackupSection(documentRef);
	} catch (err: unknown) {
		logExtensionError("Failed to initialize options page", err, "options_page");
	}
}
