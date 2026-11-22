import { LIQUIDITY_LABELS, LIQUIDITY_LEVELS } from './liquidity';

it('labels every liquidity level from low to high', () => {
  expect(LIQUIDITY_LEVELS.map((l) => LIQUIDITY_LABELS[l])).toEqual([
    'Very low',
    'Low',
    'Medium',
    'High',
    'Very high',
  ]);
});
