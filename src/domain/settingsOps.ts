import { dataFileSchema, type DataFile, type Settings } from './schema';

/** Change app-level settings (validated). */
export function updateSettings(data: DataFile, patch: Partial<Settings>): DataFile {
  return dataFileSchema.parse({ ...data, settings: { ...data.settings, ...patch } });
}
