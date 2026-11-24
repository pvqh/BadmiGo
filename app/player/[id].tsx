import { useLocalSearchParams } from 'expo-router';
import { PlayerProfile } from '../../src/ui/player-profile';

export default function Player() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlayerProfile fallbackName="This player" profileId={id} />;
}
