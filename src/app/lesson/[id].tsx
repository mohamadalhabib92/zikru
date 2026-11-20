/**
 * Lecture d’une leçon sans obliger la vidéo. Le son, s’il y en a, est l’appel du groupe.
 * Le drapeau teaching.shared_reading reste faux : cet écran dit alors que la lecture n’est pas ouverte.
 */
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SharedReading } from '@/components/lesson/shared-reading';
import { getClassLesson } from '@/lib/lessons/api';
import { Button, Screen, Spacer } from '@/ui/kit';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lessonId = String(id ?? '');

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Lecture partagée' }} />
      <SharedReading lessonId={lessonId} />
      <Spacer h={8} />
      <Button
        icon="call-outline"
        title="Rejoindre en audio"
        onPress={() => {
          void getClassLesson(lessonId).then((l) => {
            if (!l) return;
            router.push({ pathname: '/call', params: { scope: 'circle', id: l.circle_id, name: l.title, lesson: lessonId } });
          });
        }}
      />
    </Screen>
  );
}
