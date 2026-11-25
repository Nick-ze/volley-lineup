import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button, ListRow, TextField, useFormStyles, useListStyles } from '@/components';
import {
  validateOpponentName,
  type OpponentNameError,
  type OpponentRecord,
} from '@/domain/seasons';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { seasonErrorText } from './seasonErrors';
import { recordLine } from './seasonText';

export interface OpponentRowProps {
  record: OpponentRecord;
  /** v10: false for view-only members (no Rename, no Delete). */
  editable: boolean;
  /** False when the opponent has matches (it can't be deleted then). */
  deletable: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

/** One opponent of the season with its record; Rename inline, Delete when it has no matches. */
export function OpponentRow({ record, editable, deletable, onOpen, onDelete }: OpponentRowProps) {
  const formStyles = useFormStyles();
  const listStyles = useListStyles();
  const t = useT();
  const s = t.seasons.opponents;
  const { opponent } = record;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(opponent.name);
  const [error, setError] = useState<OpponentNameError | undefined>();

  if (editing) {
    const save = () => {
      const { opponents } = useAppStore.getState();
      const result = validateOpponentName(name, opponents, opponent.seasonId, opponent.id);
      if (!result.ok) return setError(result.error);
      useAppStore.getState().renameOpponent(opponent.id, result.name);
      setEditing(false);
    };
    return (
      <View style={formStyles.card} testID={`opponent-edit-${opponent.id}`}>
        <TextField
          label={s.newName(opponent.name)}
          value={name}
          onChangeText={setName}
          error={seasonErrorText(t, error, 'opponent')}
          onSubmitEditing={save}
          autoFocus
        />
        <View style={formStyles.actions}>
          <Button
            label={t.common.cancel}
            variant="secondary"
            compact
            onPress={() => setEditing(false)}
          />
          <Button label={t.common.save} compact onPress={save} />
        </View>
      </View>
    );
  }

  const line = recordLine(t, record);
  return (
    <ListRow
      title={opponent.name}
      subtitle={
        <Text style={listStyles.subtitle} testID="opponent-record">
          {line}
        </Text>
      }
      onPress={onOpen}
      accessibilityLabel={`${s.open(opponent.name)}. ${line}`}
      testID={`opponent-${opponent.id}`}
      actions={
        editable ? (
          <View style={listStyles.actions}>
            <Button
              label={s.rename}
              accessibilityLabel={s.renameLabel(opponent.name)}
              variant="secondary"
              compact
              onPress={() => {
                setName(opponent.name);
                setError(undefined);
                setEditing(true);
              }}
            />
            {deletable ? (
              <Button
                label={s.delete}
                accessibilityLabel={s.deleteLabel(opponent.name)}
                variant="danger"
                compact
                onPress={onDelete}
              />
            ) : null}
          </View>
        ) : undefined
      }
    />
  );
}
