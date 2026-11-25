import { useLocalSearchParams } from 'expo-router';

import { MembersScreen } from '@/features/members/MembersScreen';

/** v10: `/team/[teamId]/members` — share a local team, or a shared team's members and invites. */
export default function MembersRoute() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  return <MembersScreen teamId={teamId} />;
}
