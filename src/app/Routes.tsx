import { AccountDetailsPage } from '@/features/accounts/AccountDetailsPage';
import { NewAccountPage } from '@/features/accounts/NewAccountPage';
import { StartPage } from '@/features/accounts/StartPage';
import { DataGate } from '@/features/data/DataGate';
import { InsightsPage } from '@/features/insights/InsightsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { useBackShortcuts, useHistoryIndex, useRoute } from './router';

/** Signed-in screens (ADR-0013). */
export function Routes() {
  const route = useRoute();
  useHistoryIndex();
  useBackShortcuts();

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
