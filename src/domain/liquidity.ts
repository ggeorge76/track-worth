/** Liquidity rating: how easily an account can be turned into cash. 1 = low … 5 = high. */
export const LIQUIDITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type Liquidity = (typeof LIQUIDITY_LEVELS)[number];

export const LIQUIDITY_LABELS: Record<Liquidity, string> = {
  1: 'Very low',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Very high',
};
