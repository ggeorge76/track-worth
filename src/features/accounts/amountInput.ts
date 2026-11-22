import { signedAmount, type Sign } from '@/domain/balances';
import { parseMoneyInput } from '@/domain/money';

export type AmountCheck = { ok: true; amountMinor: number | null } | { ok: false; error: string };

/**
 * Validate a typed amount and apply the sign. Empty input is `null` (allowed only where the
 * amount is optional; callers decide).
 */
export function checkSignedAmount(amount: string, sign: Sign, currency: string): AmountCheck {
  const text = amount.trim();
  if (text === '') return { ok: true, amountMinor: null };
  if (text.startsWith('-')) {
    return { ok: false, error: 'Type the amount without a minus sign, and choose − instead.' };
  }
  const magnitude = parseMoneyInput(text, currency);
  if (magnitude === null) return { ok: false, error: 'Enter an amount, like 1,234.50.' };
  return { ok: true, amountMinor: signedAmount(magnitude, sign) };
}
