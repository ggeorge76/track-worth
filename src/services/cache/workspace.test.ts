import { makeFile } from '@/test/builders';
import { emptySnapshot } from '@/test/mockStore';
import { createMemoryStore } from './fileCache';
import { workspaceOn } from './workspace';

describe('workspace', () => {
  it('keeps the last synced data and the user’s name until cleared', async () => {
    const ws = workspaceOn(createMemoryStore());
    expect(await ws.loadSynced()).toBeUndefined();
    const state = { data: makeFile(), snapshot: emptySnapshot };
    await ws.saveSynced(state);
    await ws.saveUser({ name: 'Ada', email: 'ada@example.com' });
    expect(await ws.loadSynced()).toEqual(state);
    expect((await ws.loadUser())?.name).toBe('Ada');
    await ws.clear();
    expect(await ws.loadSynced()).toBeUndefined();
    expect(await ws.loadUser()).toBeUndefined();
  });
});
