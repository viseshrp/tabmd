# Privacy Policy

TabMD stores note data and settings locally in the extension storage area by default. It also includes an optional, user-initiated Google Drive backup feature.

## Data handling
- No remote services are required for normal note taking.
- No analytics or telemetry are included.
- Google Drive access is only used when you explicitly connect your account and run backup/restore actions.

## Local data
- Preferences such as theme are stored locally.
- Notes are stored locally in `chrome.storage.local`.
- Optional Drive backup metadata such as retention count, install ID, and cached backup rows are also stored locally.

## Optional Google Drive backup
- When you choose to use Drive backup, TabMD uploads a JSON snapshot containing your notes to your own Google Drive.
- Backup files are stored under `tabmd_backups/<install_id>/`.
- Drive backups are retained according to your configured retention count.
- TabMD does not transmit note data anywhere else.
