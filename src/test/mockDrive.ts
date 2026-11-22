/**
 * Shared fake Drive client for screen tests. Use with (vi.mock is hoisted, hence the import):
 *   vi.mock('@/services/drive/driveClient', async (importOriginal) =>
 *     (await import('@/test/mockDrive')).mockDriveModule(importOriginal));
 */
import type * as driveModule from '@/services/drive/driveClient';
import type { DriveClient } from '@/services/drive/driveClient';

export const fakeDrive = {
  loadOrCreate: vi.fn<DriveClient['loadOrCreate']>(),
  save: vi.fn<DriveClient['save']>(() => Promise.resolve('2')),
};

export async function mockDriveModule(importOriginal: () => Promise<typeof driveModule>) {
  return { ...(await importOriginal()), createDriveClient: () => fakeDrive };
}
