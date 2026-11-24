import { PlayerProfile } from '../../src/ui/player-profile';
import { useMember } from '../../src/ui/session';

export default function Me() {
  const me = useMember();
  return <PlayerProfile fallbackName={me.display_name} profileId={me.id} underStatusBar />;
}
