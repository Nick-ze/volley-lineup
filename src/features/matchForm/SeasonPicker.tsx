import { Text, View } from 'react-native';

import type { Season } from '@/domain/types';
import { ChoiceChip } from '@/features/roster/components/ChoiceChip';
import { formStyles } from '@/features/roster/components/styles';
import { TextField } from '@/features/roster/components/TextField';
import { useT } from '@/i18n';

import { chipStyles } from './chipStyles';

export interface SeasonPickerProps {
  /** The team's seasons, newest first. */
  seasons: readonly Season[];
  /** Opened from a season: only that season is shown, not a choice. */
  fixed: boolean;
  value: string | null;
  onChange: (seasonId: string) => void;
  /** The name of the season created with the match when the team has none. */
  newName: string;
  onNewName: (name: string) => void;
  error?: string;
}

/** Which season / tournament the new match goes into: fixed, a choice, or a new one. */
export function SeasonPicker(props: SeasonPickerProps) {
  const { seasons, fixed, value, onChange, newName, onNewName, error } = props;
  const t = useT();
  const s = t.roster.matchForm;
  const line = (x: Season) => t.roster.seasonLine(x.name, t.roster.seasonKind[x.kind]);

  if (seasons.length === 0) {
    return (
      <View>
        <TextField
          label={s.seasonName}
          value={newName}
          onChangeText={onNewName}
          error={error}
          testID="match-new-season-name"
        />
        <Text style={formStyles.hint}>{s.seasonNew}</Text>
      </View>
    );
  }
  const chosen = seasons.find((x) => x.id === value);
  if (fixed && chosen) {
    return (
      <View>
        <Text style={formStyles.sectionLabel}>{s.season}</Text>
        <Text style={chipStyles.value} testID="match-new-season">
          {line(chosen)}
        </Text>
      </View>
    );
  }
  return (
    <View style={chipStyles.group}>
      <Text style={formStyles.sectionLabel}>{s.season}</Text>
      <View style={chipStyles.wrap} accessibilityRole="radiogroup" accessibilityLabel={s.season}>
        {seasons.map((x) => (
          <ChoiceChip
            key={x.id}
            role="radio"
            // Tournaments say so on the chip; seasons only in the label.
            label={x.kind === 'tournament' ? line(x) : x.name}
            accessibilityLabel={
              x.kind === 'tournament'
                ? line(x)
                : t.roster.seasonLabel(x.name, t.roster.seasonKind[x.kind])
            }
            selected={x.id === value}
            onPress={() => onChange(x.id)}
            testID={`match-new-season-${x.id}`}
          />
        ))}
      </View>
      {error ? <Text style={chipStyles.error}>{error}</Text> : null}
    </View>
  );
}
