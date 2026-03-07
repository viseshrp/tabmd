import { getDriveAuthStatus } from '../drive/auth';

export async function initDriveAuthPage(): Promise<void> {
  const statusEl = document.querySelector<HTMLElement>('#status');
  if (!statusEl) return;
  const status = await getDriveAuthStatus();
  statusEl.textContent = status.connected
    ? `Connected to ${status.provider}.`
    : 'No provider connected.';
}

