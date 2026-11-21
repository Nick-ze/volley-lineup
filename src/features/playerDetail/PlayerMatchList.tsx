import { Text, View } from 'react-native';

import { plusMinus, type PlayerMatchLine } from '@/domain/performance';
import { matchResultLabel } from '@/features/live/matchResult';
import { ListRow } from '@/features/roster/components/ListRow';
import { listStyles } from '@/features/roster/components/styles';
import { useT } from '@/i18n';

export interface PlayerMatchListProps {
  lines: PlayerMatchLine[];
  onOpenMatch: (matchId: string) => void;
}

/** One row per match the player appears in: opponent, date, result and the main numbers. */
export function PlayerMatchList({ lines, onOpenMatch }: PlayerMatchListProps) {
  const t = useT();
  const s = t.playerDetail.matches;
  return (
    <View style={listStyles.list} testID="player-matches">
      <Text style={listStyles.title} accessibilityRole="header">
        {s.heading}
      </Text>
      {lines.map(({ match, rallies, performance: p }) => {
        const result = matchResultLabel(t, match);
        const numbers = {
          sets: p.setsPlayed,
          rallies: p.rallies,
          of: rallies,
          plusMinus: t.playerDetail.signed(plusMinus(p)),
          kills: p.kills,
          aces: p.aces,
          blocks: p.blocks,
          errors: p.errors,
        };
        const head = result ? `${match.date}${t.playerDetail.separator}${result}` : match.date;
        return (
          <ListRow
            key={match.id}
            title={s.vs(match.opponent)}
            subtitle={
              <>
                <Text style={listStyles.subtitle}>{head}</Text>
                <Text style={listStyles.subtitle} testID={`player-match-${match.id}-numbers`}>
                  {s.line(numbers)}
                </Text>
              </>
            }
            onPress={() => onOpenMatch(match.id)}
            accessibilityLabel={[
              s.open(match.opponent, match.date),
              result ? t.match.resultLabel(result) : null,
              s.lineLabel(numbers),
            ]
              .filter((x) => x !== null)
              .join(t.playerDetail.sentenceSeparator)}
            testID={`player-match-${match.id}`}
          />
        );
      })}
    </View>
  );
}
