export type DriveAuthStatus = {
  connected: boolean;
  provider: 'none' | 'google-drive';
};

export async function getDriveAuthStatus(): Promise<DriveAuthStatus> {
  return { connected: false, provider: 'none' };
}

