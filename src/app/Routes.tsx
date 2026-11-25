import { AccountDetailsPage } from '@/features/accounts/AccountDetailsPage';
import { NewAccountPage } from '@/features/accounts/NewAccountPage';
import { StartPage } from '@/features/accounts/StartPage';
import { DataGate } from '@/features/data/DataGate';
import { CurrenciesPage } from '@/features/fx/CurrenciesPage';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useBackShortcuts, useHistoryIndex, useRoute, useScrollToTop } from './router';

/** Signed-in screens (ADR-0013). */
export function Routes() {
  const route = useRoute();
  useHistoryIndex();
  useBackShortcuts();
  useScrollToTop(route);

  return (
    <DataGate>
      {({ data }) => {
        switch (route.name) {
          case 'new-account':
            return <NewAccountPage data={data} />;
          case 'settings':
            return <SettingsPage data={data} />;
          case 'insights':
            return <InsightsPage data={data} />;
          case 'currencies':
            return <CurrenciesPage data={data} />;
          case 'account':
            return <AccountDetailsPage key={route.id} data={data} accountId={route.id} />;
          case 'home':
          case 'not-found':
            return <StartPage data={data} />;
        }
      }}
    </DataGate>
  );
}
