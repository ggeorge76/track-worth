import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { createFakeDrive } from '@/test/fakeDriveApi';
import { createSampleBackups, SAMPLE_BACKUP_FOLDER } from './sampleBackup';

const real = makeFile({
  baseCurrency: 'INR',
  accounts: [makeAccount({ id: 'bank', currency: 'INR' })],
  balances: [makeEntry({ accountId: 'bank', amountMinor: 1_234 })],
  netWorthHistory: [{ date: '2020-01-31', amountMinor: 5, currency: 'INR' }],
});
const at = (iso: string) => new Date(iso);

function setup() {
  const drive = createFakeDrive();
  const root = drive.seed('TrackWorth/settings.json', {}).parent;
  return { drive, root, backups: createSampleBackups(drive.api) };
}

describe('sample backups', () => {
  it('saves verified, timestamped backups, never overwriting one', async () => {
    const { drive, root, backups } = setup();
    expect(await backups.list(root)).toEqual([]);
    const first = await backups.save(root, real, at('2026-11-26T10:15:00.123Z'));
    const second = await backups.save(root, makeFile(), at('2026-11-26T11:00:00.000Z'));
    expect(first).toMatchObject({
      name: 'backup-2026-11-26T10-15-00-123Z.json',
      takenAt: '2026-11-26T10:15:00.123Z',
    });
    expect((await backups.list(root)).map((b) => b.id)).toEqual([first.id, second.id]);
    expect(drive.at(`TrackWorth/${SAMPLE_BACKUP_FOLDER}/${first.name}`)).toBeDefined();
    expect(await backups.load(first.id)).toEqual(real);
  });

  it('removes one backup (to the trash), leaving the others', async () => {
    const { drive, root, backups } = setup();
    const first = await backups.save(root, real, at('2026-11-26T10:00:00Z'));
    const second = await backups.save(root, real, at('2026-11-26T12:00:00Z'));
    await backups.remove(first.id);
    expect(drive.isTrashed(first.id)).toBe(true);
    expect((await backups.list(root)).map((b) => b.id)).toEqual([second.id]);
  });

  it('removes a backup that doesn’t read back identically, and refuses to continue', async () => {
    const { drive, root, backups } = setup();
    let reads = 0;
    const api = {
      ...drive.api,
      readJson: (id: string) =>
        ++reads === 1 ? Promise.resolve({ ...real, baseCurrency: 'USD' }) : drive.api.readJson(id),
    };
    await expect(
      createSampleBackups(api).save(root, real, at('2026-11-26T10:00:00Z')),
    ).rejects.toThrow('didn’t check out');
    await expect(
      createSampleBackups({ ...drive.api, readJson: () => Promise.resolve({ nope: true }) }).save(
        root,
        real,
        at('2026-11-26T10:00:01Z'),
      ),
    ).rejects.toThrow('didn’t check out');
    expect(await backups.list(root)).toEqual([]);
  });

  it('ignores other files in the folder, and explains an unreadable backup', async () => {
    const { drive, root, backups } = setup();
    drive.seed(`TrackWorth/${SAMPLE_BACKUP_FOLDER}/notes.txt.json`, {});
    const bad = drive.seed(`TrackWorth/${SAMPLE_BACKUP_FOLDER}/backup-2026-01-01T00-00-00Z.json`, {
      garbage: true,
    });
    expect(await backups.list(root)).toEqual([
      { id: bad.id, name: 'backup-2026-01-01T00-00-00Z.json', takenAt: '2026-01-01T00:00:00.000Z' },
    ]);
    await expect(backups.load(bad.id)).rejects.toThrow('couldn’t be read');
  });
});
