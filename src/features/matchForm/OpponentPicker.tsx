import { ScrollView, Text, View } from 'react-native';

import { MAX_OPPONENT_NAME_LENGTH } from '@/domain/seasons';
import type { Opponent } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { formStyles } from '@/features/roster/components/styles';
import { TextField } from '@/features/roster/components/TextField';
import { useT } from '@/i18n';

import { chipStyles } from './chipStyles';

export interface OpponentPickerProps {
  /** The season's opponents, by name. */
  opponents: readonly Opponent[];
  /** The season's name, for the hints (the typed name of a new season). */
  seasonName: string;
  /** The opponent the form currently stands for (chip, or a typed name that matches one). */
  selectedId: string | null;
  onSelect: (opponentId: string) => void;
  name: string;
  onName: (name: string) => void;
  error?: string;
}

/** The season's opponents as chips (they wrap, and scroll when many) plus a new-name field. */
export function OpponentPicker(props: OpponentPickerProps) {
  const { opponents, seasonName, selectedId, onSelect, name, onName, error } = props;
  const t = useT();
  const s = t.roster.matchForm;
  const typed = name.trim();
  const match = opponents.find((o) => o.id === selectedId);
  // A typed name says whether it is one of the season's opponents (by its own spelling) or new.
  const hint = typed === '' ? null : match ? s.existing(match.name) : s.willAdd(typed, seasonName);

  return (
    <View style={chipStyles.group}>
      {opponents.length > 0 ? (
        <>
          <Text style={formStyles.sectionLabel}>{s.opponentChips(seasonName)}</Text>
          <ScrollView style={chipStyles.scroll} nestedScrollEnabled testID="match-new-opponents">
            <View
              style={chipStyles.wrap}
              accessibilityRole="radiogroup"
              accessibilityLabel={s.opponentChips(seasonName)}
            >
              {opponents.map((o) => (
                <ChoiceChip
                  key={o.id}
                  role="radio"
                  label={o.name}
                  selected={o.id === selectedId}
                  onPress={() => onSelect(o.id)}
                  testID={`match-new-opponent-${o.id}`}
                />
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
      <TextField
        label={opponents.length > 0 ? s.newOpponent : s.opponent}
        value={name}
        onChangeText={onName}
        error={error}
        autoFocus={opponents.length === 0}
        maxLength={MAX_OPPONENT_NAME_LENGTH}
        testID="match-new-opponent-name"
      />
      {hint && !error ? <Text style={formStyles.hint}>{hint}</Text> : null}
    </View>
  );
}
