import { GPS_DENIED, GPS_UNAVAILABLE, type GpsFailure } from '@/lib/gps-hint';
import { L } from '@/lib/l10n';
import { Notice } from '@/ui/kit';

/** Explique un échec de position, sans effacer la ville déjà choisie. */
export function GpsHint({ reason }: { reason: GpsFailure | null }) {
  if (!reason) return null;
  const text = reason === 'denied' ? L(GPS_DENIED) : L(GPS_UNAVAILABLE);
  return <Notice tone="warning" title={text} icon="location-outline" />;
}
