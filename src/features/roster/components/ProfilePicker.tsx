import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components';
import type { ManagerProfile } from '@/domain/types';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { useConfirm } from '../hooks/useConfirm';
import { Avatar } from './Avatar';
import { ConfirmDialog } from './ConfirmDialog';
import { ListRow } from './ListRow';
import { ProfileForm } from './ProfileForm';
import { listStyles as styles } from './styles';

type Editing = { mode: 'create' } | { mode: 'edit'; profile: ManagerProfile } | null;

/** Lists, creates, renames and deletes manager profiles. */
export function ProfilePicker({ onSelect }: { onSelect: (profileId: string) => void }) {
  const t = useT();
  const profiles = useAppStore((s) => s.profiles);
  const { addProfile, updateProfile, deleteProfile } = useAppStore.getState();
  const [editing, setEditing] = useState<Editing>(
    profiles.length === 0 ? { mode: 'create' } : null,
  );
  const { ask, dialogProps } = useConfirm();
  const s = t.roster.profiles;

  return (
    <>
      <View style={styles.headerRow}>
        <Text style={styles.heading} accessibilityRole="header">
          {s.heading}
        </Text>
        {editing === null && (
          <Button label={s.new} onPress={() => setEditing({ mode: 'create' })} compact />
        )}
      </View>

      {editing?.mode === 'create' && (
        <ProfileForm
          submitLabel={s.create}
          onCancel={() => setEditing(null)}
          onSubmit={(value) => {
            const profile = addProfile(value);
            setEditing(null);
            // Go straight into the new profile: creating it is never the end goal.
            onSelect(profile.id);
          }}
        />
      )}

      {profiles.length === 0 && editing === null && <Text style={styles.empty}>{s.empty}</Text>}
      {profiles.length > 0 && editing === null && <Text style={styles.empty}>{s.hint}</Text>}

      <View style={styles.list}>
        {profiles.map((p) =>
          editing?.mode === 'edit' && editing.profile.id === p.id ? (
            <ProfileForm
              key={p.id}
              initial={{ name: p.name, color: p.color }}
              submitLabel={t.common.save}
              onCancel={() => setEditing(null)}
              onSubmit={(value) => {
                updateProfile(p.id, value);
                setEditing(null);
              }}
            />
          ) : (
            <ListRow
              key={p.id}
              title={p.name}
              leading={<Avatar name={p.name} color={p.color} />}
              onPress={() => onSelect(p.id)}
              accessibilityLabel={s.select(p.name)}
              actions={
                <>
                  <Button
                    label={t.common.rename}
                    accessibilityLabel={s.rename(p.name)}
                    variant="ghost"
                    compact
                    onPress={() => setEditing({ mode: 'edit', profile: p })}
                  />
                  <Button
                    label={t.common.delete}
                    accessibilityLabel={s.delete(p.name)}
                    variant="danger"
                    compact
                    onPress={() =>
                      ask(t.roster.confirm.deleteProfile(p.name), () => deleteProfile(p.id))
                    }
                  />
                </>
              }
            />
          ),
        )}
      </View>
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
