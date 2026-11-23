import { z } from 'zod';

/**
 * Frozen copy of the version 2 data-file schema (single file `trackworth-data.json`). Never edit:
 * it describes files that may still exist in users' Drives. Used only to validate input to the
 * v2 → v3 migration.
 */
const id = z.string().min(1).max(64);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const tag = z.string().trim().min(1).max(40);

export const dataFileV2Schema = z.object({
  schemaVersion: z.literal(2),
  updatedAt: z.iso.datetime(),
  baseCurrency: currencyCode,
  settings: z.object({
    financialYearStartMonth: z.int().min(1).max(12),
    customTags: z.array(tag),
  }),
  accounts: z.array(
    z.object({
      id,
      name: z.string().trim().min(1).max(100),
      kind: z.enum(['asset', 'liability']),
      tag,
      liquidity: z.int().min(1).max(5),
      currency: currencyCode,
      balanceSource: z.string().trim().min(1).max(60).optional(),
      archived: z.boolean(),
      note: z.string().max(2000).optional(),
      createdAt: z.iso.datetime(),
    }),
  ),
  balances: z.array(
    z.object({
      id,
      accountId: id,
      date: z.iso.date(),
      amountMinor: z.int(),
      note: z.string().max(500).optional(),
      recordedAt: z.iso.datetime(),
    }),
  ),
});

export type DataFileV2 = z.infer<typeof dataFileV2Schema>;
