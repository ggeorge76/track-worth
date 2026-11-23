import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { isDesktopApp } from '@/services/platform';

/**
 * Saves an export (R-S2, ADR-0016). In the desktop app, Rust shows the system "Save as…" dialog
 * and writes the file; in a plain browser (dev, e2e) the file is downloaded.
 */

export type SaveResult = 'saved' | 'cancelled';

export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExportError';
  }
}

const rustErrorSchema = z.object({ code: z.string(), message: z.string() });

function download(fileName: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function saveExport(fileName: string, contents: string): Promise<SaveResult> {
  if (!isDesktopApp()) {
    download(fileName, contents, fileName.endsWith('.csv') ? 'text/csv' : 'application/json');
    return 'saved';
  }
  try {
    const saved = await invoke<boolean>('export_save', { fileName, contents });
    return saved ? 'saved' : 'cancelled';
  } catch (err) {
    const parsed = rustErrorSchema.safeParse(err);
    throw new ExportError(
      parsed.success ? parsed.data.message : 'Couldn’t save the file. Please try again.',
    );
  }
}
