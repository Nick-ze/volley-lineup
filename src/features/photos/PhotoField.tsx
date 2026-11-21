import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Photo } from '@/components';
import { useT } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { draftHasPhoto, type PhotoDraft } from './photoDraft';
import { usePhotoPicker } from './usePhotoPicker';

/** Diameter of the picture in a form. */
export const FORM_PHOTO_SIZE = 64;

export interface PhotoFieldProps {
  /** The saved picture of the profile / player (none for a new one). */
  photoId: string | undefined;
  draft: PhotoDraft;
  onChange: (draft: PhotoDraft) => void;
  /** Shown without a picture (the avatar or the jersey number), at `FORM_PHOTO_SIZE`. */
  fallback: ReactNode;
  /** True while a picked picture is being prepared: the form disables Save meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}

/** A form's picture: preview, Add / Change (camera or gallery) and Remove, saved on Save. */
export function PhotoField({ photoId, draft, onChange, fallback, onBusyChange }: PhotoFieldProps) {
  const t = useT();
  const s = t.photos;
  const picker = usePhotoPicker((uri) => onChange({ kind: 'new', uri }), onBusyChange);
  const hasPhoto = draftHasPhoto(draft, photoId);
  const note = picker.busy
    ? s.processing
    : picker.problem !== null
      ? s[picker.problem]
      : draft.kind === 'new'
        ? s.unsaved
        : draft.kind === 'removed' && photoId !== undefined
          ? s.removed
          : null;

  return (
    <View style={styles.box} testID="photo-field">
      <View style={styles.row}>
        {draft.kind === 'removed' ? (
          fallback
        ) : (
          <Photo
            photoId={photoId}
            uri={draft.kind === 'new' ? draft.uri : undefined}
            size={FORM_PHOTO_SIZE}
            fallback={fallback}
          />
        )}
        <View style={styles.actions}>
          {picker.choosing ? (
            <>
              <Button label={s.takePhoto} compact onPress={() => picker.pick('camera')} />
              <Button label={s.choosePhoto} compact onPress={() => picker.pick('library')} />
              <Button
                label={t.common.cancel}
                accessibilityLabel={s.cancelChoiceLabel}
                variant="ghost"
                compact
                onPress={picker.cancel}
              />
            </>
          ) : (
            <>
              <Button
                label={hasPhoto ? s.change : s.add}
                accessibilityHint={s.addHint}
                variant="secondary"
                compact
                disabled={picker.busy}
                onPress={picker.start}
              />
              {hasPhoto ? (
                <Button
                  label={s.remove}
                  variant="danger"
                  compact
                  disabled={picker.busy}
                  onPress={() => onChange({ kind: 'removed' })}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
      {note !== null ? (
        <Text
          style={[styles.note, picker.problem !== null && styles.problem]}
          accessibilityLiveRegion="polite"
          testID="photo-note"
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted },
  problem: { color: colors.error },
});
