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
- When you choose to use Drive backup, TabMD uploads one snapshot ZIP containing individual Markdown note files to your own Google Drive.
- Backup files are stored under `tabmd_backups/<install_id>/`.
- Each extension install gets its own `install_id` subfolder so multiple TabMD installs stay separated in Drive.
- Drive backups are retained according to your configured retention count.
- TabMD does not transmit note data anywhere else.
- Drive authentication requires an OAuth client configured for TabMD's own extension ID.
