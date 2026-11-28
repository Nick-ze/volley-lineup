import { View } from 'react-native';

import { TextField } from '@/components';
import { MAX_HOSTED_PLAYER_NUMBER } from '@/domain/hostedTournament';
import { MAX_NAME_LENGTH } from '@/domain/syncSchema';
import { makeStyles, spacing } from '@/theme';

export interface PlayerFieldsProps {
  number: string;
  name: string;
  onNumber: (text: string) => void;
  onName: (text: string) => void;
  numberLabel: string;
  nameLabel: string;
  numberPlaceholder?: string;
  namePlaceholder?: string;
  /** Shown under the name field (it belongs to both). */
  error?: string;
  onSubmit: () => void;
  autoFocus?: boolean;
  testID: string;
}

/** Width of the number field (three digits; wider with the dyslexia font). */
const NUMBER_WIDTH = 88;
const NUMBER_WIDTH_WIDE_FONT = 104;
const NUMBER_DIGITS = `${MAX_HOSTED_PLAYER_NUMBER}`.length;

/** A player's two fields side by side: a short number field and the name. */
export function PlayerFields({
  number,
  name,
  onNumber,
  onName,
  numberLabel,
  nameLabel,
  numberPlaceholder,
  namePlaceholder,
  error,
  onSubmit,
  autoFocus,
  testID,
}: PlayerFieldsProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.number}>
        <TextField
          label={numberLabel}
          value={number}
          onChangeText={(text) => onNumber(text.replace(/\D/g, '').slice(0, NUMBER_DIGITS))}
          placeholder={numberPlaceholder}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={NUMBER_DIGITS}
          onSubmitEditing={onSubmit}
          autoFocus={autoFocus}
          testID={`${testID}-number`}
        />
      </View>
      <View style={styles.name}>
        <TextField
          label={nameLabel}
          value={name}
          onChangeText={onName}
          placeholder={namePlaceholder}
          maxLength={MAX_NAME_LENGTH}
          error={error}
          onSubmitEditing={onSubmit}
          testID={`${testID}-name`}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  number: { width: theme.dyslexiaFont ? NUMBER_WIDTH_WIDE_FONT : NUMBER_WIDTH },
  name: { flex: 1, minWidth: 0 },
}));
