import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useToday } from '@/app/useToday';
import { createConverter, rateNeeds, type Converter, type RateOverrides } from '@/domain/fx';
import type { DataFile } from '@/domain/schema';
import { createRatesApi } from '@/services/fx/frankfurter';
import { rateStore } from '@/services/fx/rateStore';
import { loadRates, type LoadedRates } from '@/services/fx/rates';

export interface ExchangeRates {
  base: string;
  fx: Converter;
  /** Fetched rates, if any (latest + monthly). */
  loaded: LoadedRates | undefined;
  overrides: RateOverrides;
  loading: boolean;
}

const api = createRatesApi();
const HOURS = 3_600_000;

/**
 * Exchange rates for showing everything in the base currency (ADR-0018). Only fetches when the
 * data has other currencies, or when `always` (the currencies page).
 */
export function useExchangeRates(data: DataFile, { always = false } = {}): ExchangeRates {
  const today = useToday();
  const base = data.baseCurrency;
  const need = rateNeeds(data);
  const fromMonth = need.fromMonth ?? today.slice(0, 7);
  const enabled = always || need.currencies.length > 0;

  const rates = useQuery({
    queryKey: ['fx-rates', base, fromMonth, need.currencies.join(','), today],
    enabled,
    networkMode: 'always',
    retry: false,
    staleTime: 6 * HOURS,
    queryFn: () =>
      loadRates({
        base,
        currencies: need.currencies,
        fromMonth,
        today,
        now: new Date(),
        api,
        store: rateStore,
      }),
  });
  const overrides = useQuery({
    queryKey: ['fx-overrides', base],
    networkMode: 'always',
    queryFn: () => rateStore.loadOverrides(base),
  });

  const table = rates.data?.stored?.table;
  const own = overrides.data;
  const fx = useMemo(
    () => createConverter(base, table, own ?? {}, today),
    [base, table, own, today],
  );
  return {
    base,
    fx,
    loaded: rates.data,
    overrides: own ?? {},
    loading: enabled && rates.isPending,
  };
}

/** Set (or with `null`, clear) the user's own rate: 1 `currency` = `value` base units. */
export function useSetRateOverride(base: string) {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: 'always',
    mutationFn: async ({ currency, value }: { currency: string; value: number | null }) => {
      const current = Object.entries(await rateStore.loadOverrides(base)).filter(
        ([c]) => c !== currency,
      );
      const next = Object.fromEntries(value === null ? current : [...current, [currency, value]]);
      await rateStore.saveOverrides(base, next);
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(['fx-overrides', base], next);
    },
  });
}
