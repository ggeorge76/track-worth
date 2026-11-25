/**
 * Says when the total isn't complete or uses older rates (ADR-0018): honest numbers never quietly
 * drop or mis-convert a currency.
 */
export function RatesNote({
  unconverted,
  problem,
}: {
  unconverted: readonly string[];
  problem?: string | undefined;
}) {
  if (unconverted.length === 0 && !problem) return null;
  return (
    <p role="note" className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
      {unconverted.length > 0 && `Not included: ${unconverted.join(', ')} (no exchange rate yet). `}
      {problem}
    </p>
  );
}
