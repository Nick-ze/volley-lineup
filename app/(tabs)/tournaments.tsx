import { Redirect, useRouter } from 'expo-router';

import { Screen } from '@/components';
import { Avatar } from '@/features/roster/components/Avatar';
import { TournamentList } from '@/features/hostedTournament/TournamentList';
import { useT } from '@/i18n';
import { selectCurrentProfile, useAppStore } from '@/store';

/** Diameter of the profile's picture beside the title (as on the Teams tab). */
const TITLE_AVATAR = 40;

/**
 * `/tournaments` tab (v12) — the tournaments the selected profile hosts: neutral scoreboards for
 * all teams of a tournament (names and results; no rosters, lineups or live scoring). A
 * tournament your own team plays in is a season of the kind "Tournament" in the team's Matches tab.
 */
export default function TournamentsScreen() {
  const router = useRouter();
  const t = useT();
  const profile = useAppStore(selectCurrentProfile);

  if (!profile) return <Redirect href="/" />;

  return (
    <Screen
      testID="tournaments-screen"
      title={{
        title: t.tournament.nav.tournaments,
        eyebrow: profile.name,
        right: (
          <Avatar
            name={profile.name}
            color={profile.color}
            photoId={profile.photoId}
            size={TITLE_AVATAR}
          />
        ),
      }}
    >
      <TournamentList
        profileId={profile.id}
        onNew={() => router.push('/tournament-new')}
        onOpen={(tournament) => router.push(`/tournament/${tournament.id}`)}
        onEdit={(tournament) => router.push(`/tournament-new?tournamentId=${tournament.id}`)}
      />
    </Screen>
  );
}
