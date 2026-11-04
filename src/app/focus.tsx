import { FocusScreen } from '@/components/FocusScreen';
import { useI18n } from '@/lib/focus-i18n';

/** Mode Focus (≥ 10 min) : le tasbih, la lecture ou les adhkar continuent dans la séance. */
export default function Focus() {
  const { t } = useI18n();
  return (
    <FocusScreen
      focusName={t('focusNameStudy')}
      activities={[
        { id: 'tasbih', label: t('focusActTasbih'), icon: 'ellipse-outline', href: '/tasbih' },
        { id: 'quran', label: t('focusActQuran'), icon: 'book-outline', href: '/quran' },
        { id: 'dhikr', label: t('focusActDhikr'), icon: 'reader-outline', href: '/dhikr' },
        { id: 'stay', label: t('focusActStay'), icon: 'leaf-outline' },
      ]}
    />
  );
}
