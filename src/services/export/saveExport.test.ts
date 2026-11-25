import { invoke, isTauri } from '@tauri-apps/api/core';
import { ExportError, saveExport } from './saveExport';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(), isTauri: vi.fn(() => true) }));

afterEach(() => {
  vi.mocked(isTauri).mockReturnValue(true);
  vi.restoreAllMocks();
});

describe('saveExport in the desktop app', () => {
  it('asks Rust to show the save dialog with the suggested name and text', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(true);
    await expect(saveExport('a.csv', 'x,y')).resolves.toBe('saved');
    expect(invoke).toHaveBeenCalledWith('export_save', { fileName: 'a.csv', contents: 'x,y' });
  });

  it('reports a cancelled dialog', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(false);
    await expect(saveExport('a.csv', '')).resolves.toBe('cancelled');
  });

  it('passes on Rust’s plain-language error', async () => {
    vi.mocked(invoke).mockRejectedValueOnce({ code: 'write', message: 'Couldn’t save there.' });
    await expect(saveExport('a.csv', '')).rejects.toEqual(new ExportError('Couldn’t save there.'));
  });

  it('falls back to a generic message for anything else', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('boom'));
    await expect(saveExport('a.csv', '')).rejects.toThrow('Couldn’t save the file');
  });
});

describe('saveExport in a browser', () => {
  it('downloads the file', async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    await expect(saveExport('b.json', '{}')).resolves.toBe('saved');
    expect(createObjectURL.mock.calls[0]?.[0].type).toBe('application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(invoke).not.toHaveBeenCalled();
  });
});
