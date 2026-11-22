import { useEffect, useState } from 'react';
import { localIsoDate } from '@/domain/dates';

/** Today's local date (YYYY-MM-DD), refreshed when the window regains focus (e.g. after midnight). */
export function useToday(): string {
  const [today, setToday] = useState(localIsoDate);
  useEffect(() => {
    const refresh = () => {
      setToday(localIsoDate());
    };
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return today;
}
