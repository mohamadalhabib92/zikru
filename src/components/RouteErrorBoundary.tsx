import { useEffect } from 'react';
import { reportCrash } from '@/lib/crash';
import { ErrorScreen } from '@/components/AppErrorBoundary';

/** Filet Expo Router : une erreur d'écran affiche un repli au lieu d'une page blanche. */
export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  useEffect(() => {
    reportCrash(error, 'route');
  }, [error]);
  return <ErrorScreen error={error} retry={() => void retry()} />;
}
