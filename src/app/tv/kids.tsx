import { FamilyBoard } from '@/components/tv/family-board';
import { TvPremiumGate } from '@/components/tv/ui';

export default function TvKids() {
  return (
    <TvPremiumGate feature="kids">
      <FamilyBoard kids />
    </TvPremiumGate>
  );
}
