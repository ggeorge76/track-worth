import { dataFileSchema, type DataFile, type Settings } from './schema';

/** Change app-level settings (validated). */
export function updateSettings(data: DataFile, patch: Partial<Settings>): DataFile {
  return dataFileSchema.parse({ ...data, settings: { ...data.settings, ...patch } });
}

/** Change the base currency: totals, charts and insights are shown in it (ADR-0018). */
export function setBaseCurrency(data: DataFile, baseCurrency: string): DataFile {
  return dataFileSchema.parse({ ...data, baseCurrency });
}
