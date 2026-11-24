import { z } from 'zod';

/**
 * Frozen copy of the version 3 data shape (ADR-0014; stored split across settings.json,
 * accounts.json and balances/*.json). Never edit: it describes data that may still exist in
 * users' Drives. Used only to validate input to the v3 → v4 migration.
 */
const id = z.string().min(1).max(64);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const tag = z.string().trim().min(1).max(40);

export const dataFileV3Schema = z.object({
  schemaVersion: z.literal(3),
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

export type DataFileV3 = z.infer<typeof dataFileV3Schema>;
