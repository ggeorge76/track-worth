import { z } from 'zod';

/**
 * Frozen copy of the version 1 data-file schema. Never edit: it describes files that already
 * exist in users' Drives. Used only to validate input to the v1 → v2 migration.
 */
const id = z.string().min(1).max(64);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);

export const v1CategorySchema = z.enum([
  'cash',
  'bank',
  'investment',
  'retirement',
  'property',
  'vehicle',
  'crypto',
  'other_asset',
  'credit_card',
  'loan',
  'mortgage',
  'other_liability',
]);

export const dataFileV1Schema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.iso.datetime(),
  baseCurrency: currencyCode,
  accounts: z.array(
    z.object({
      id,
      name: z.string().trim().min(1).max(100),
      kind: z.enum(['asset', 'liability']),
      category: v1CategorySchema,
      currency: currencyCode,
      archived: z.boolean(),
      note: z.string().max(1000).optional(),
      createdAt: z.iso.datetime(),
    }),
  ),
  balances: z.array(
    z.object({
      id,
      accountId: id,
      date: z.iso.date(),
      // v1: liabilities stored the amount owed as a POSITIVE number.
      amountMinor: z.int(),
      note: z.string().max(500).optional(),
      recordedAt: z.iso.datetime(),
    }),
  ),
});

export type DataFileV1 = z.infer<typeof dataFileV1Schema>;
