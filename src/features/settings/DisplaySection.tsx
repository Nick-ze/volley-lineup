import { ToggleRow } from '@/components';
import { useT } from '@/i18n';
import { useAppStore } from '@/store';

import { Section } from './Section';

/** "Show names instead of numbers" on the player chips. Persisted, kept on "Delete all". */
export function DisplaySection() {
  const t = useT();
  const chipLabel = useAppStore((s) => s.chipLabel);
  const setChipLabel = useAppStore((s) => s.setChipLabel);
  const s = t.language.display;
  return (
    <Section title={s.title} hint={s.hint}>
      <ToggleRow
        label={s.namesInsteadOfNumbers}
        value={chipLabel === 'name'}
        onChange={(on) => setChipLabel(on ? 'name' : 'number')}
        testID="toggle-chip-names"
      />
    </Section>
  );
}
